import { createFileRoute, Link } from "@tanstack/react-router";
import { StoryApp } from "@/components/story/story-app";

export const Route = createFileRoute("/story")({ component: StoryPage });

/** Render the shared story editor with a brand link back to the website home page. */
function StoryPage() {
  return (
    <StoryApp
      brand={(content) => (
        <Link to="/" className="flex min-w-0 items-center gap-3">
          {content}
        </Link>
      )}
    />
  );
}
