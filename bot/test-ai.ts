import { pipeline, cos_sim } from '@xenova/transformers';

async function runTests() {
    console.log("📥 Loading AI Model for Testing...");
    const extract = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    const idealLead = "I am looking to hire a professional residential house cleaner for a deep clean of my home.";
    const idealOutput = await extract(idealLead, { pooling: 'mean', normalize: true });

    const tests = [
        {
            name: "Perfect Match",
            text: "Does anyone know a good house cleaner? We need someone to come once a week for our 4 bedroom home.",
            expected: true
        },
        {
            name: "Different Service (Car Cleaning)",
            text: "I spent 5 hours cleaning the interior of my car today, it was exhausting.",
            expected: false
        },
        {
            name: "Irrelevant Chat",
            text: "Who has the best recipe for cleaning a cast iron skillet? Need help ASAP.",
            expected: false
        },
        {
            name: "Commercial Cleaning",
            text: "Looking for a commercial cleaning company to handle our 5-story office building downtown.",
            expected: false // Should score lower than residential
        }
    ];

    console.log("\n🧪 Running Tests against Semantic Search Engine:");
    console.log(`Reference Lead: "${idealLead}"\n`);

    for (const t of tests) {
        const postOutput = await extract(t.text, { pooling: 'mean', normalize: true });
        const similarity = cos_sim(Array.from(postOutput.data), Array.from(idealOutput.data));
        const score = (similarity * 100).toFixed(2);
        const passed = similarity > 0.45;

        console.log(`Test: ${t.name}`);
        console.log(`Post: "${t.text}"`);
        console.log(`Score: ${score}% -> Result: ${passed ? "✅ APPROVED" : "❌ REJECTED"}`);
        console.log(`Expected: ${t.expected ? "APPROVE" : "REJECT"}`);
        console.log(passed === t.expected ? "🟢 PASS\n" : "🔴 FAIL\n");
    }
}

runTests();
