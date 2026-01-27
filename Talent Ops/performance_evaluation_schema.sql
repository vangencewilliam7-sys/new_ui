-- Create employee_reviews table
CREATE TABLE IF NOT EXISTS employee_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Self Assessment
    development_skills JSONB,
    soft_skills JSONB,
    
    -- Manager Assessment
    manager_id UUID REFERENCES profiles(id),
    manager_development_skills JSONB,
    manager_soft_skills JSONB,
    manager_feedback TEXT,
    manager_score_dev NUMERIC,
    manager_score_soft NUMERIC,
    manager_score_total NUMERIC,
    manager_score_percentage NUMERIC,
    
    -- Executive Assessment
    executive_remarks TEXT,
    
    date_reviewed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE employee_reviews ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can read their own reviews
CREATE POLICY "Users can read own reviews" ON employee_reviews
    FOR SELECT USING (auth.uid() = user_id);

-- Managers can read all reviews within their org (simplified, ideally strictly their direct reports)
-- Assuming profiles has org_id
CREATE POLICY "Managers can read org reviews" ON employee_reviews
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.org_id = (SELECT org_id FROM profiles WHERE id = employee_reviews.user_id)
            AND (profiles.role = 'manager' OR profiles.role = 'executive' OR profiles.role = 'admin')
        )
    );

-- Managers can insert/update reviews
CREATE POLICY "Managers can upsert reviews" ON employee_reviews
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'manager' OR profiles.role = 'executive' OR profiles.role = 'admin')
        )
    );

-- Users can insert/update their own self-review
CREATE POLICY "Users can upsert own self-review" ON employee_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own self-review" ON employee_reviews
    FOR UPDATE USING (auth.uid() = user_id);

-- Create View for Rankings
-- Joins reviews with profile data for the leaderboard
CREATE OR REPLACE VIEW employee_rankings_view AS
SELECT 
    er.user_id,
    er.manager_score_total,
    er.manager_score_percentage,
    er.manager_score_dev,
    er.manager_score_soft,
    p.full_name,
    p.avatar_url,
    p.job_title,
    p.department,
    p.org_id
FROM 
    employee_reviews er
JOIN 
    profiles p ON er.user_id = p.id
WHERE 
    er.manager_score_total IS NOT NULL;
