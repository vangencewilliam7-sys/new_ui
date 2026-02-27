// @ts-nocheck — This file runs on Supabase's Deno runtime, not locally
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * AI-Native Task Planning Assistant
 * 
 * SOLID Implementation:
 * S - Single Responsibility: Only handles planning request + context building + LLM call.
 * O - Open/Closed: Models can be swapped via env variables.
 * L - Liskov: Input/output schema is strictly typed.
 * I - Interface Segregation: Only requires task context, not full user objects.
 * D - Dependency Inversion: Clients depend on this API, implementation details hidden.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, description, skills, taskType } = await req.json()

    if (!title || !description) {
      throw new Error('Task title and description are required')
    }

    // 1. Initialize Supabase Client (for Context Retrieval)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 2. Fetch Similar Task Context (SLM / RAG Lite)
    // We only fetch step titles to respect privacy (No PII)
    const { data: contextData } = await supabase.rpc('rpc_get_similar_task_context', {
      p_skill_tags: skills || [],
      p_limit: 3
    })

    // Format context for LLM
    let contextString = "No previous similar tasks found."
    if (contextData && contextData.length > 0) {
      contextString = "Here are examples of how similar tasks were structured in the past (use as style guide only):\n"
      contextData.forEach((t: any) => {
        contextString += `- Task: "${t.task_title}" had steps: [${t.step_titles.join(', ')}]\n`
      })
    }

    // 3. Construct LLM Prompt
    // Single Responsibility: Prompt Engineering is isolated here
    const systemPrompt = `You are a Senior Technical Project Manager.
      Your goal is to break down a software task into granular execution steps.
      
      RULES:
      1. Return ONLY valid JSON. No markdown. No conversational text.
      2. Phases must be one of: 'requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment'.
      3. Each step MUST have a duration of EITHER 2 or 4 hours. No other values allowed.
      4. Max 8 total steps across all phases.
      5. Include a 'risk' level (low/medium/high) for each step.
      
      OUTPUT SCHEMA:
      {
        "suggested_plan": [
          {
            "phase": "design_guidance",
            "title": "Create DB Schema",
            "duration": 4,
            "risk": "medium",
            "note": "Check foreign keys"
          }
        ],
        "ai_metadata": {
          "overall_risks": ["Risk 1", "Risk 2"],
          "assumptions": ["Assumption 1"],
          "model": "gpt-4o-mini"
        }
      }`

    const userPrompt = `TASK: ${title}
      DESCRIPTION: ${description}
      SKILLS: ${skills?.join(', ')}
      TYPE: ${taskType || 'General'}
      
      CONTEXT FROM HISTORY:
      ${contextString}
      
      Generate a detailed execution plan.`

    // 4. Call OpenAI (or any LLM Provider)
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) throw new Error('OpenAI API Key not configured')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective, fast model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Low validation for consistent output
        max_tokens: 1000
      }),
    })

    const llmData = await response.json()
    const rawContent = llmData.choices?.[0]?.message?.content

    if (!rawContent) {
      throw new Error('Failed to generate plan from AI')
    }

    // 5. Parse & Validate Response (Zero Trust)
    let parsedPlan
    try {
      // Strip markdown code blocks if present
      const jsonStr = rawContent.replace(/^```json\n|\n```$/g, '')
      parsedPlan = JSON.parse(jsonStr)
    } catch (e) {
      console.error("JSON Parse Fail", rawContent)
      throw new Error('AI returned invalid JSON format')
    }

    // Strict Validation: Ensure 2h/4h rule
    if (parsedPlan.suggested_plan) {
      parsedPlan.suggested_plan = parsedPlan.suggested_plan.map((step: any) => ({
        ...step,
        duration: [2, 4].includes(Number(step.duration)) ? Number(step.duration) : 4 // Default to 4 if invalid
      }))
    }

    return new Response(
      JSON.stringify(parsedPlan),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
