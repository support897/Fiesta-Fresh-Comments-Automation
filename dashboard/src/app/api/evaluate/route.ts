import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { post_id, group_url, post_text } = body;

    if (!post_text || !post_id || !group_url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch AI Memory (Rules)
    const { data: memoryData } = await supabase.from('ai_memory').select('rule_text');
    const rules = memoryData?.map(m => `- ${m.rule_text}`).join('\n') || 'No specific rules yet.';

    // 2. Evaluate with Gemini
    const prompt = `
      You are an expert lead evaluator for a residential house cleaning company called Fiesta Fresh Cleaning.
      Your job is to read a Facebook post and decide if it's a good lead to comment on.
      
      Rules based on past feedback:
      ${rules}
      
      Post: "${post_text}"
      
      If this is a solid lead for HOUSE CLEANING (not commercial, not cars, not generic chatter), reply with "APPROVE".
      If it's irrelevant, a different service, or violates the rules, reply with "REJECT: [Reason]".
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const aiText = response.text?.trim() || 'REJECT: AI Error';
    const isApproved = aiText.startsWith('APPROVE');

    // If AI explicitly rejects, we might still save it as rejected, or just drop it.
    // Let's save it as pending only if AI approves, so human can double check (RLHF).
    if (isApproved) {
      await supabase.from('leads').upsert({
        post_id,
        group_url,
        post_text,
        status: 'pending' // Human needs to swipe
      }, { onConflict: 'post_id' });
    } else {
      // Auto-reject
      await supabase.from('leads').upsert({
        post_id,
        group_url,
        post_text,
        status: 'rejected',
        rejection_reason: aiText
      }, { onConflict: 'post_id' });
    }

    return NextResponse.json({ success: true, ai_decision: aiText });

  } catch (error) {
    console.error('Error in evaluate AI route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
