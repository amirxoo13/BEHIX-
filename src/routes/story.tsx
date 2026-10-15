import { createFileRoute, Link } from "@tanstack/react-router";
import { StoryApp } from "@/components/story/story-app";

export const Route = createFileRoute("/story")({ component: StoryPage });

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
