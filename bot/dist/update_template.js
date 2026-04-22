import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
async function updateTemplate() {
    const newText = "Hi there! We are fully insured and police checked, and we would absolutely love to help you out 💙 You can view our prices and book directly in 60 seconds here: https://www.fiestafreshcleaning.com/book ✨ Or send a direct message to https://www.facebook.com/share/1KZ42C9jSc/?mibextid=wwXIfr 💙\n#FiestaFresh #GoldCoastCleaning #ReliableCleaners #HouseCleaning #BondClean";
    const { error } = await supabase.from('templates').update({ content: newText }).eq('is_active', true);
    if (error)
        console.error(error);
    else
        console.log("Template successfully updated!");
}
updateTemplate();
//# sourceMappingURL=update_template.js.map