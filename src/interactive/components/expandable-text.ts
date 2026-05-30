/**
 * ExpandableText component - shows collapsed or expanded text
 * Reimplemented from pi-coding-agent's interactive-mode
 */
import { Text } from '@earendil-works/pi-tui';

export class ExpandableText extends Text {
	private collapsedText: string;
	private expandedText: string;

	constructor(
		collapsedText: string,
		expandedText: string,
		expandedInitially = false,
		paddingX = 0,
		paddingY = 0
	) {
		super(expandedInitially ? expandedText : collapsedText, paddingX, paddingY);
		this.collapsedText = collapsedText;
		this.expandedText = expandedText;
	}

	setExpanded(expanded: boolean): void {
		this.setText(expanded ? this.expandedText : this.collapsedText);
	}
}
