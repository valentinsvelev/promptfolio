/** Manually curated release notes. Add one entry for every published version from v0.3.0 onward.
 * Historical titles and dates are based on Promptfolio's GitHub commit history.
 * New features that have not been released should not be assigned a version here.
 */
export type ChangelogEntry = {
  version: string;
  date?: string;
  title: string;
  status: 'release' | 'development';
  changes: string[];
};

export const changelog: ChangelogEntry[] = [
  {
    version: '0.3.6', date: '2026-11-06', title: 'Navigation and architecture improvements', status: 'release',
    changes: [
      'Hash-based routing: Dedicated URLs for Explore, My prompts, Teams, Reviews, Admin, and Changelog.',
      'Authentication routing: Separate #/sign-in and #/sign-up pages.',
      'Browser history: Support for direct links, refreshes, and Back/Forward navigation.',
      'Code refactoring: Split the large App.tsx into smaller, feature-organized React components.',
      'Automated testing: Added Playwright browser tests for desktop and mobile.',
      'Repository cleanup: Removed unused legacy files.'
    ],
  },
  {
    version: '0.3.5', date: '2026-11-05', title: 'Email sharing and changelog', status: 'release',
    changes: [
      'Added an email composer for sharing prompts, requesting feedback, and inviting collaboration.',
      'Added a changelog page to browse release history.',
      'Refined interface styling and other visual details.',
    ],
  },
  {
    version: '0.3.4', date: '2026-11-01', title: 'More focused prompt filters', status: 'release',
    changes: [
      'Added quick category filters to Favorites.',
      'Added category filters within the selected team in My teams.',
    ],
  },
  {
    version: '0.3.3', date: '2026-10-31', title: 'Feedback and editor refinements', status: 'release',
    changes: [
      'Added in-app bug reports and suggestions that create GitHub Issues.',
      'Refined the create, edit and suggestion form fields.',
    ],
  },
  {
    version: '0.3.2', date: '2026-10-30', title: 'Dark mode and filtering', status: 'release',
    changes: [
      'Introduced dark mode.',
      'Improved quick filtering and the prompt browsing experience.',
      'Refined the logo presentation in dark mode.',
    ],
  },
  {
    version: '0.3.1', date: '2026-10-28', title: 'A more usable interface', status: 'release',
    changes: [
      'Updated the interface to focus on a clearer, smoother user experience.',
      'Improved navigation and prompt discovery.',
    ],
  },
  {
    version: '0.3.0', date: '2026-10-27', title: 'First tracked release', status: 'release',
    changes: [
      'Introduced the compact app header.',
      'Added the GitHub Actions deployment workflow.',
      'Established v0.3.0 as the first publicly tracked release version.',
    ],
  },
  {
    version: '0.2.0', title: 'Development milestone', status: 'development',
    changes: ['Internal development version; no separate public release notes.'],
  },
  {
    version: '0.1.0', title: 'Early development', status: 'development',
    changes: ['Initial development version; no separate public release notes.'],
  },
];
