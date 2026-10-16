import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { StoryApp } from "@/components/story/story-app";
import { useStoryWorkspace } from "@/studio/stick/use-workspace";

export const Route = createFileRoute("/story")({
  validateSearch: (search: Record<string, unknown>): { project?: string } => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  component: StoryPage,
});

/** Render the shared story editor with a brand link back to the website home page. */
function StoryPage() {
  const search = Route.useSearch();
  const workspace = useStoryWorkspace("", search.project);
  useBlocker({ shouldBlockFn: async () => !(await workspace.flush()), enableBeforeUnload: workspace.saving || !!workspace.message });
  return (
    <StoryApp
      workspace={workspace}
      projectsLink={<Link to="/projects" className="btn btn-ghost">پروژه‌ها</Link>}
      brand={(content) => (
        <Link to="/" className="studio-brand" aria-label="خانه">
          {content}
        </Link>
      )}
    />
  );
}
