-- Insert demo workspace for testing
INSERT INTO workspaces (id, name, tier, "createdAt") 
VALUES ('demo-workspace-123', 'Demo Workspace', 'FREE', NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test prompts
INSERT INTO prompts (id, "workspaceId", text, "canonicalText", intent, vertical, active, tags, "createdAt")
VALUES 
  ('prompt-1', 'demo-workspace-123', 'What is influencer marketing?', 'what is influencer marketing', 'HOWTO', 'marketing', true, ARRAY['influencer', 'marketing'], NOW()),
  ('prompt-2', 'demo-workspace-123', 'Best influencer marketing platforms', 'best influencer marketing platforms', 'BEST', 'software', true, ARRAY['influencer', 'platforms'], NOW()),
  ('prompt-3', 'demo-workspace-123', 'Alternatives to AspireIQ', 'alternatives to aspireiq', 'ALTERNATIVES', 'software', true, ARRAY['aspireiq', 'alternatives'], NOW())
ON CONFLICT (id) DO NOTHING;
