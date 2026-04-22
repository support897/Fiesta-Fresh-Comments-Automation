import { createClient } from '@supabase/supabase-js';
const supabase = createClient("https://xbqkcjobdnrbetrgjjrd.supabase.co", "sb_publishable_UWbZXjdMsf_Ikp2LtPRWyA_85Wop9Xg");
async function seed() {
    console.log("Seeding Database...");
    // 1. Add some keywords
    const keywords = ['cleaner', 'bond clean', 'carpet clean', 'recommendation', 'gold coast cleaner'];
    for (let word of keywords) {
        await supabase.from('keywords').insert({ phrase: word });
    }
    // 2. Add an example group
    await supabase.from('groups').insert({ url: 'https://www.facebook.com/groups/SomeDummyGroupForTesting/', is_active: true });
    // 3. Toggle bot ON for test
    await supabase.from('config').update({ bot_status: true }).eq('bot_status', false);
    console.log("Database seeded successfully!");
}
seed();
//# sourceMappingURL=seed.js.map