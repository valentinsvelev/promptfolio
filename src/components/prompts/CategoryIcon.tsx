import { FileText, Search, LayoutGrid, Settings2, Sparkles, Clock3, Lightbulb, type LucideIcon } from 'lucide-react';
const categories: Record<string, { icon: LucideIcon; tone: string }> = {
  Writing: {icon: FileText, tone:'lilac'},
  Research: {icon: Search,tone:'sand'},
  Analysis: {icon: LayoutGrid,tone:'sky'},
  Engineering:{icon: Settings2,tone:'slate'},
  Marketing:{icon: Sparkles,tone:'peach'},
  Productivity:{icon: Clock3,tone:'mint'},
  General:{icon: Lightbulb,tone:'lilac'},
};

export function IconTile({category}:{category:string}){const item=categories[category]||categories.General;const Icon=item.icon;return <span className={`icon-tile tone-${item.tone}`}><Icon size={18} strokeWidth={1.8}/></span>}
