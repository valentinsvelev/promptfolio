import '../../styles/workflowMastheads.css';

// The same static brand separator is shared by every content page.
// Keep an off-screen h1 so pages retain an accessible main heading.
export type WorkflowMastheadKind =
  | 'explore'
  | 'mine'
  | 'collections'
  | 'teams'
  | 'reviews'
  | 'admin'
  | 'changelog';

const titles: Record<WorkflowMastheadKind, string> = {
  explore: 'Explore.',
  mine: 'My prompts',
  collections: 'Collections',
  teams: 'Teams',
  reviews: 'Reviews',
  admin: 'Admin',
  changelog: 'Changelog',
};

export function WorkflowMasthead({kind}: {kind: WorkflowMastheadKind}) {
  const title = titles[kind];
  return (
    <section className={`workflow-masthead workflow-masthead-${kind}`} aria-label={`${title} separator`}>
      <h1 className="workflow-masthead-visually-hidden">{title}</h1>
      <span className="workflow-masthead-line" aria-hidden="true" />
    </section>
  );
}
