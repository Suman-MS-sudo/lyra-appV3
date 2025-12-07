'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createSuperCustomer(formData: FormData) {
  const email = formData.get('email') as string;
  const fullName = formData.get('full_name') as string;
  const orgName = formData.get('org_name') as string;
  const orgEmail = formData.get('org_email') as string;
  const orgPhone = formData.get('org_phone') as string;
  const orgAddress = formData.get('org_address') as string;

  // Check if user already exists in auth
  const { data: existingUsers } = await serviceSupabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find(u => u.email === email);
  
  if (existingUser) {
    // User exists in auth, try to recover by creating/updating profile
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: existingProfile } = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('id', existingUser.id)
      .single();

    if (!existingProfile) {
      // Create the missing profile
      const { error: insertError } = await serviceSupabase
        .from('profiles')
        .insert({
          id: existingUser.id,
          email: existingUser.email,
          full_name: fullName,
          account_type: 'super_customer',
          role: 'customer'
        });

      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`);
      }
    } else {
      // Update existing profile
      await serviceSupabase
        .from('profiles')
        .update({
          full_name: fullName,
          account_type: 'super_customer',
          role: 'customer'
        })
        .eq('id', existingUser.id);
    }

    // Create or update organization
    const { data: existingOrg } = await serviceSupabase
      .from('organizations')
      .select('id')
      .eq('super_customer_id', existingUser.id)
      .single();

    if (!existingOrg) {
      const { error: orgError } = await serviceSupabase
        .from('organizations')
        .insert({
          name: orgName,
          contact_email: orgEmail,
          contact_phone: orgPhone,
          address: orgAddress,
          super_customer_id: existingUser.id
        });

      if (orgError) {
        throw new Error(`Failed to create organization: ${orgError.message}`);
      }
    }

    // Send password reset email
    await serviceSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
    });

    revalidatePath('/admin/super-customers');
    redirect('/admin/super-customers');
    return;
  }

  // Generate random secure password
  const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16) + 'Aa1!';

  // Create auth user with random password
  const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'customer',
      account_type: 'super_customer'
    }
  });

  if (authError) {
    throw new Error(authError.message);
  }

  // Wait a bit for trigger to create profile, then verify it exists
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const { data: existingProfile } = await serviceSupabase
    .from('profiles')
    .select('id')
    .eq('id', authData.user.id)
    .single();

  if (!existingProfile) {
    // Profile doesn't exist, create it manually
    const { error: insertError } = await serviceSupabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        full_name: fullName,
        account_type: 'super_customer',
        role: 'customer'
      });

    if (insertError) {
      // If profile creation fails, delete the auth user to keep things clean
      await serviceSupabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(insertError.message);
    }
  } else {
    // Update existing profile
    const { error: profileError } = await serviceSupabase
      .from('profiles')
      .update({
        full_name: fullName,
        account_type: 'super_customer',
        role: 'customer'
      })
      .eq('id', authData.user.id);

    if (profileError) {
      throw new Error(profileError.message);
    }
  }

  // Create organization
  const { error: orgError } = await serviceSupabase
    .from('organizations')
    .insert({
      name: orgName,
      contact_email: orgEmail,
      contact_phone: orgPhone,
      address: orgAddress,
      super_customer_id: authData.user.id
    });

  if (orgError) {
    // If organization creation fails, clean up
    await serviceSupabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(orgError.message);
  }

  // Send password reset email
  const { error: resetError } = await serviceSupabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
  });

  if (resetError) {
    console.error('Password reset email error:', resetError);
  }

  revalidatePath('/admin/super-customers');
  redirect('/admin/super-customers');
}

export async function createCustomerUser(formData: FormData) {
  const email = formData.get('email') as string;
  const fullName = formData.get('full_name') as string;
  const organizationId = formData.get('organization_id') as string;
  const canEdit = formData.get('can_edit') === 'true';

  // Generate random secure password
  const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16) + 'Aa1!';

  // Create auth user with random password
  const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'customer',
      account_type: 'customer'
    }
  });

  if (authError) {
    throw new Error(authError.message);
  }

  // Wait a bit for trigger to create profile, then verify it exists
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const { data: existingProfile } = await serviceSupabase
    .from('profiles')
    .select('id')
    .eq('id', authData.user.id)
    .single();

  if (!existingProfile) {
    // Profile doesn't exist, create it manually
    const { error: insertError } = await serviceSupabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        full_name: fullName,
        account_type: 'customer',
        role: 'customer',
        organization_id: organizationId,
        permissions: {
          can_edit: canEdit,
          can_view: true
        }
      });

    if (insertError) {
      throw new Error(insertError.message);
    }
  } else {
    // Update profile with organization and permissions
    const { error: profileError } = await serviceSupabase
      .from('profiles')
      .update({
        full_name: fullName,
        account_type: 'customer',
        role: 'customer',
        organization_id: organizationId,
        permissions: {
          can_edit: canEdit,
          can_view: true
        }
      })
      .eq('id', authData.user.id);

    if (profileError) {
      throw new Error(profileError.message);
    }
  }

  // Send password reset email
  const { error: resetError } = await serviceSupabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`
  });

  if (resetError) {
    console.error('Password reset email error:', resetError);
  }

  revalidatePath('/super-customer/users');
  redirect('/super-customer/users');
}

export async function updateCustomerPermissions(userId: string, formData: FormData) {
  const canEdit = formData.get('can_edit') === 'true';

  const { error } = await serviceSupabase
    .from('profiles')
    .update({
      permissions: {
        can_edit: canEdit,
        can_view: true
      }
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/super-customer/users');
}

export async function updateSuperCustomer(formData: FormData) {
  const userId = formData.get('user_id') as string;
  const orgId = formData.get('org_id') as string;
  const fullName = formData.get('full_name') as string;
  const orgName = formData.get('org_name') as string;
  const orgEmail = formData.get('org_email') as string;
  const orgPhone = formData.get('org_phone') as string;
  const orgAddress = formData.get('org_address') as string;

  // Update profile
  const { error: profileError } = await serviceSupabase
    .from('profiles')
    .update({
      full_name: fullName
    })
    .eq('id', userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  // Update organization if it exists
  if (orgId) {
    const { error: orgError } = await serviceSupabase
      .from('organizations')
      .update({
        name: orgName,
        contact_email: orgEmail,
        contact_phone: orgPhone,
        address: orgAddress
      })
      .eq('id', orgId);

    if (orgError) {
      throw new Error(orgError.message);
    }
  } else {
    // Create organization if it doesn't exist
    const { error: orgError } = await serviceSupabase
      .from('organizations')
      .insert({
        name: orgName,
        contact_email: orgEmail,
        contact_phone: orgPhone,
        address: orgAddress,
        super_customer_id: userId
      });

    if (orgError) {
      throw new Error(orgError.message);
    }
  }

  revalidatePath('/admin/super-customers');
  redirect('/admin/super-customers');
}
