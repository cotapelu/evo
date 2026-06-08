/**
 * ExpandableText component - shows collapsed or expanded text
 * Reimplemented from pi-coding-agent's interactive-mode
 */
import { Text } from '@earendil-works/pi-tui';
export declare class ExpandableText extends Text {
    private collapsedText;
    private expandedText;
    constructor(collapsedText: string, expandedText: string, expandedInitially?: boolean, paddingX?: number, paddingY?: number);
    setExpanded(expanded: boolean): void;
}
//# sourceMappingURL=expandable-text.d.ts.map