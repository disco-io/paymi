import { supabase } from '@/lib/supabase';
import { normalizeUsername } from '@/lib/username';
import type { Profile } from '@/types/database';

export async function fetchProfileById(profileId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', normalized)
    .maybeSingle();

  if (error) throw error;
  if (!data) return true;
  return excludeUserId ? data.id === excludeUserId : false;
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const ext = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function updateProfile(
  userId: string,
  fields: {
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  }
): Promise<Profile> {
  const username = normalizeUsername(fields.username);

  const payload: Record<string, string | null> = {
    display_name: fields.displayName.trim(),
    username,
  };
  if (fields.avatarUrl !== undefined) {
    payload.avatar_url = fields.avatarUrl;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    if (
      error.message.includes('profiles_username_lower_idx') ||
      error.message.includes('duplicate key')
    ) {
      throw new Error('this username is taken — pick another');
    }
    throw error;
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      display_name: fields.displayName.trim(),
      username,
    },
  });
  if (metaError) throw metaError;

  return data;
}
