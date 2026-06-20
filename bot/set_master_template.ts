import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const masterTemplate = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

async function setMasterTemplate() {
  console.log("Setting master template...");
  
  // 1. Deactivate all existing templates
  const { error: deactivateError } = await supabase
    .from('templates')
    .update({ is_active: false })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Hack to update all

  if (deactivateError) {
    console.error("Error deactivating existing templates:", deactivateError);
    return;
  }

  // 2. Check if master template exists, if so update it, else insert
  const { data: existing, error: checkError } = await supabase
    .from('templates')
    .select('*')
    .eq('content', masterTemplate)
    .single();

  if (existing) {
    console.log("Template exists, setting it to active...");
    const { error: updateError } = await supabase
      .from('templates')
      .update({ is_active: true })
      .eq('id', existing.id);
    if (updateError) {
        console.error("Error activating template:", updateError);
    } else {
        console.log("Success! Master template activated.");
    }
  } else {
    console.log("Template does not exist, inserting...");
    const { error: insertError } = await supabase
      .from('templates')
      .insert({ content: masterTemplate, is_active: true, name: 'Master Template' });
      
    if (insertError) {
      console.error("Error inserting template:", insertError);
    } else {
      console.log("Success! Master template inserted and activated.");
    }
  }
}

setMasterTemplate();
