/**
 * ExpandableText component - shows collapsed or expanded text
 * Reimplemented from pi-coding-agent's interactive-mode
 */
import { Text } from '@earendil-works/pi-tui';
export class ExpandableText extends Text {
    collapsedText;
    expandedText;
    constructor(collapsedText, expandedText, expandedInitially = false, paddingX = 0, paddingY = 0) {
        super(expandedInitially ? expandedText : collapsedText, paddingX, paddingY);
        this.collapsedText = collapsedText;
        this.expandedText = expandedText;
    }
    setExpanded(expanded) {
        this.setText(expanded ? this.expandedText : this.collapsedText);
    }
}
//# sourceMappingURL=expandable-text.js.map