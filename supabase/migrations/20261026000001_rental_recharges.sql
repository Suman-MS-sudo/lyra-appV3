-- ============================================================================
-- Machine rentals and recharge plans
--
-- Rentals are booked and paid on the public website (lyraenterprise.co.in),
-- which writes here with the service role. Each rented machine gets one
-- rental_agreements row; every payment (the signup payment and each later
-- Monthly / Quarterly / Yearly recharge) is a rental_recharges row.
--
-- Rent is tracked as a "paid until" date:
--   * before installation the agreement has no start_date; paid months are
--     banked in prepaid_months
--   * when Lyra installs the machine, an admin sets start_date (+ machine_id)
--     and paid_until becomes start_date + prepaid_months
--   * each recharge extends paid_until by its months, always from the current
--     paid_until (arrears are never skipped)
--
-- State is derived from paid_until (see rental_state()):
--   active  -> paid_until >= today
--   grace   -> up to 7 days past paid_until (machine still works)
--   locked  -> more than 7 days past paid_until (UPI/RFID vends refused)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rental_agreements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Customer-facing code, one per machine, e.g. LYR-R261026-QB3I-1
  rental_code      TEXT NOT NULL UNIQUE,
  -- Website booking reference shared by every machine in one booking
  booking_ref      TEXT NOT NULL,
  machine_index    INT  NOT NULL DEFAULT 1,

  plan_id          TEXT NOT NULL CHECK (plan_id IN ('r25', 'r50', 'r100')),
  capacity         INT  NOT NULL,
  monthly_rent     NUMERIC(10, 2) NOT NULL,          -- ex-GST
  model_slug       TEXT NOT NULL,
  model_name       TEXT NOT NULL,

  -- Filled in by an admin at installation
  machine_id       UUID REFERENCES public.vending_machines(id) ON DELETE SET NULL,
  start_date       DATE,
  paid_until       DATE,
  prepaid_months   INT  NOT NULL DEFAULT 0,          -- months paid before start_date is set
  min_term_months  INT  NOT NULL DEFAULT 36,

  deposit_amount   NUMERIC(10, 2) NOT NULL DEFAULT 0, -- ex-GST, 0 on the advance option
  deposit_status   TEXT NOT NULL DEFAULT 'none' CHECK (deposit_status IN ('none', 'held', 'refunded', 'adjusted')),

  -- Manual lifecycle overrides; day-to-day state comes from rental_state()
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ended', 'cancelled')),

  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,                    -- 10 digits, used to authorise website recharges
  customer_email   TEXT NOT NULL,
  organisation     TEXT,
  gstin            TEXT,
  site_address     TEXT,
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_ref, machine_index)
);

CREATE INDEX IF NOT EXISTS idx_rental_agreements_machine    ON public.rental_agreements(machine_id);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_paid_until ON public.rental_agreements(paid_until);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_phone      ON public.rental_agreements(customer_phone);

CREATE TABLE IF NOT EXISTS public.rental_recharges (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id         UUID NOT NULL REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
  kind                 TEXT NOT NULL CHECK (kind IN ('signup', 'monthly', 'quarterly', 'yearly', 'manual')),
  months               INT  NOT NULL CHECK (months > 0),
  rent_amount          NUMERIC(12, 2) NOT NULL,      -- months x monthly rent, before discount
  discount_pct         NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  discount_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deposit_amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gst_amount           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount         NUMERIC(12, 2) NOT NULL,      -- what was charged
  period_start         DATE,                         -- set once the agreement has a start_date
  period_end           DATE,
  status               TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  source               TEXT NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'dashboard', 'admin')),
  razorpay_order_id    TEXT,
  razorpay_payment_id  TEXT,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agreement_id, razorpay_order_id)
);

CREATE INDEX IF NOT EXISTS idx_rental_recharges_agreement ON public.rental_recharges(agreement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_recharges_order     ON public.rental_recharges(razorpay_order_id);

-- One row per reminder actually sent, so the daily job never repeats one.
CREATE TABLE IF NOT EXISTS public.rental_reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id  UUID NOT NULL REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('due_7', 'due_1', 'expired', 'locked')),
  paid_until    DATE NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agreement_id, kind, paid_until)
);

-- ── State ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rental_state(p_status TEXT, p_start DATE, p_paid_until DATE)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_status <> 'open'                      THEN p_status
    WHEN p_start IS NULL OR p_paid_until IS NULL THEN 'pending_install'
    WHEN p_paid_until >= CURRENT_DATE            THEN 'active'
    WHEN p_paid_until + 7 >= CURRENT_DATE        THEN 'grace'
    ELSE 'locked'
  END;
$$;

-- True when a machine's rental is past its grace period. Machines with no
-- open rental agreement are never locked.
CREATE OR REPLACE FUNCTION public.machine_rental_locked(p_machine UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rental_agreements a
    WHERE a.machine_id = p_machine
      AND public.rental_state(a.status, a.start_date, a.paid_until) = 'locked'
  );
$$;

-- ── Applying a payment ──────────────────────────────────────────────────────

-- Marks a recharge paid and extends the agreement, exactly once. Safe to call
-- repeatedly (browser verify, status check and webhook can all race).
CREATE OR REPLACE FUNCTION public.apply_rental_recharge(p_recharge UUID, p_payment_id TEXT)
RETURNS public.rental_agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.rental_recharges;
  a public.rental_agreements;
  v_from DATE;
BEGIN
  SELECT * INTO r FROM public.rental_recharges WHERE id = p_recharge FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental recharge % not found', p_recharge;
  END IF;

  SELECT * INTO a FROM public.rental_agreements WHERE id = r.agreement_id FOR UPDATE;

  IF r.status = 'paid' THEN
    RETURN a;  -- already applied
  END IF;

  IF a.start_date IS NULL THEN
    -- Not installed yet: bank the months.
    UPDATE public.rental_agreements
       SET prepaid_months = prepaid_months + r.months, updated_at = NOW()
     WHERE id = a.id
     RETURNING * INTO a;
    UPDATE public.rental_recharges
       SET status = 'paid', razorpay_payment_id = p_payment_id, paid_at = NOW()
     WHERE id = r.id;
  ELSE
    v_from := COALESCE(a.paid_until, a.start_date - 1) + 1;
    UPDATE public.rental_agreements
       SET paid_until = (v_from + make_interval(months => r.months))::date - 1, updated_at = NOW()
     WHERE id = a.id
     RETURNING * INTO a;
    UPDATE public.rental_recharges
       SET status = 'paid', razorpay_payment_id = p_payment_id, paid_at = NOW(),
           period_start = v_from, period_end = a.paid_until
     WHERE id = r.id;
  END IF;

  RETURN a;
END;
$$;

-- Called by an admin at installation: links the machine, sets the start date
-- and turns banked months into a paid_until date.
CREATE OR REPLACE FUNCTION public.start_rental(p_agreement UUID, p_machine UUID, p_start DATE)
RETURNS public.rental_agreements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.rental_agreements;
  r public.rental_recharges;
  v_from DATE;
BEGIN
  SELECT * INTO a FROM public.rental_agreements WHERE id = p_agreement FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental agreement % not found', p_agreement;
  END IF;
  IF a.start_date IS NOT NULL THEN
    RAISE EXCEPTION 'rental % already started on %', a.rental_code, a.start_date;
  END IF;

  UPDATE public.rental_agreements
     SET machine_id = p_machine,
         start_date = p_start,
         paid_until = CASE WHEN prepaid_months > 0
                           THEN (p_start + make_interval(months => prepaid_months))::date - 1
                           ELSE p_start - 1 END,
         prepaid_months = 0,
         updated_at = NOW()
   WHERE id = a.id
   RETURNING * INTO a;

  -- Back-fill the covered period on payments made before installation,
  -- one after another in the order they were paid.
  v_from := p_start;
  FOR r IN
    SELECT * FROM public.rental_recharges
     WHERE agreement_id = a.id AND status = 'paid' AND period_start IS NULL
     ORDER BY paid_at, created_at
  LOOP
    UPDATE public.rental_recharges
       SET period_start = v_from,
           period_end = (v_from + make_interval(months => r.months))::date - 1
     WHERE id = r.id;
    v_from := (v_from + make_interval(months => r.months))::date;
  END LOOP;

  RETURN a;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_rental_recharge(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_rental(UUID, UUID, DATE)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_rental_recharge(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_rental(UUID, UUID, DATE)     TO service_role;

-- ── Row Level Security ──────────────────────────────────────────────────────
-- The website and server code use the service role (bypasses RLS). These
-- policies cover signed-in dashboard users reading directly.

ALTER TABLE public.rental_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_recharges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_reminders  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage rental agreements" ON public.rental_agreements;
CREATE POLICY "Admins manage rental agreements" ON public.rental_agreements FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Customers view rentals of their machines" ON public.rental_agreements;
CREATE POLICY "Customers view rentals of their machines" ON public.rental_agreements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.vending_machines vm
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE vm.id = rental_agreements.machine_id
      AND (vm.customer_id::text = p.id::text
           OR (p.account_type = 'super_customer' AND vm.customer_id::text = p.organization_id::text))
  ));

DROP POLICY IF EXISTS "Admins manage rental recharges" ON public.rental_recharges;
CREATE POLICY "Admins manage rental recharges" ON public.rental_recharges FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Customers view recharges of their rentals" ON public.rental_recharges;
CREATE POLICY "Customers view recharges of their rentals" ON public.rental_recharges FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rental_agreements a WHERE a.id = rental_recharges.agreement_id));

DROP POLICY IF EXISTS "Admins view rental reminders" ON public.rental_reminders;
CREATE POLICY "Admins view rental reminders" ON public.rental_reminders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE OR REPLACE FUNCTION public.set_rental_agreements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rental_agreements_updated_at ON public.rental_agreements;
CREATE TRIGGER trg_rental_agreements_updated_at
  BEFORE UPDATE ON public.rental_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_rental_agreements_updated_at();
