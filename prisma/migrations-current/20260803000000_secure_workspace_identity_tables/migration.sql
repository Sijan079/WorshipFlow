ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceInvitation" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "User", "WorkspaceMembership", "WorkspaceInvitation" FROM anon, authenticated;
