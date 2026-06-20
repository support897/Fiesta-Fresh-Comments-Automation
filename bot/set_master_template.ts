import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

const MASTER_COMMENT = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

async function main() {
    console.log("Updating templates table in Supabase...");
    
    // Deactivate all existing templates
    const { error: deactivateError } = await supabase
        .from('templates')
        .update({ is_active: false })
        .neq('content', 'DUMMY_TEMPLATE_THAT_DOES_NOT_EXIST');

    if (deactivateError) {
        console.error("Error deactivating templates:", deactivateError);
    }

    // Check if the master comment already exists
    const { data: existing, error: fetchError } = await supabase
        .from('templates')
        .select('*')
        .eq('content', MASTER_COMMENT)
        .limit(1);

    if (fetchError) {
        console.error("Error fetching template:", fetchError);
        return;
    }

    if (existing && existing.length > 0) {
        // Activate the existing template
        const { error: updateError } = await supabase
            .from('templates')
            .update({ is_active: true })
            .eq('id', existing[0].id);

        if (updateError) {
            console.error("Error activating template:", updateError);
        } else {
            console.log("✅ Master comment template activated!");
        }
    } else {
        // Insert and activate new template
        const { error: insertError } = await supabase
            .from('templates')
            .insert({ content: MASTER_COMMENT, is_active: true });

        if (insertError) {
            console.error("Error inserting template:", insertError);
        } else {
            console.log("✅ Master comment template inserted and activated!");
        }
    }

    // Confirm active templates
    const { data: active, error: confirmError } = await supabase
        .from('templates')
        .select('*')
        .eq('is_active', true);

    if (confirmError) {
        console.error("Confirm error:", confirmError);
    } else {
        console.log("Current active templates in Supabase:", active);
    }
}

main();
