import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDirectory, '../../.env');
dotenv.config({ path: rootEnvPath });

import { getSupabaseClient } from '../src/config/supabase.js';

(async function(){
  try {
    const supabase = getSupabaseClient();
    const { data: active, error: aErr } = await supabase.from('tracked_products').select('id').eq('is_active', true);
    const { data: inactive, error: iErr } = await supabase.from('tracked_products').select('id').eq('is_active', false);
    if (aErr || iErr) {
      console.error('Error querying counts', aErr || iErr);
      process.exit(1);
    }
    console.log('active_count:', (active||[]).length);
    console.log('inactive_count:', (inactive||[]).length);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
