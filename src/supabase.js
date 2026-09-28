import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL||'https://mzopnroctqeftvankwrv.supabase.co';
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_wBMY5M5pr1kWM04lrMgQrw_DCQommU1';
export const supabase=url&&key?createClient(url,key):null;
