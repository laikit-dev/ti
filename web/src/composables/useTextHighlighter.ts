import { reactive } from "vue";

export type HighlightColor = "red" | "yellow" | "green";

export interface HighlightToolbarState {
  visible: boolean;
  x: number;
  y: number;
}

interface TextNodeSegment {
  node: Text;
  start: number;
  end: number;
}

export function useTextHighlighter() {
  const toolbarState = reactive<HighlightToolbarState>({
    visible: false,
    x: 0,
    y: 0
  });

  let currentContainer: HTMLElement | null = null;
  let lastSelectionRange: Range | null = null;
  let documentMouseDownBound = false;

  function isInsideContainer(node: Node | null): boolean {
    if (!currentContainer || !node) return false;
    return currentContainer.contains(node);
  }

  function onMouseUp(event: MouseEvent) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      dismissToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!isInsideContainer(range.commonAncestorContainer)) {
      dismissToolbar();
      return;
    }

    if (range.toString().trim().length === 0) {
      dismissToolbar();
      return;
    }

    lastSelectionRange = range.cloneRange();

    // Position toolbar near the mouse-up point (viewport coordinates, since CSS uses position:fixed)
    toolbarState.x = event.clientX + 8;
    toolbarState.y = event.clientY + 6;
    toolbarState.visible = true;
  }

  function onDocumentMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest(".highlight-toolbar")) return;
    // Any click outside the toolbar dismisses it. A subsequent text selection
    // inside the container will open it again from onMouseUp.
    if (toolbarState.visible) {
      dismissToolbar();
    }
  }

  function bindContainer(el: HTMLElement | null) {
    if (currentContainer) {
      currentContainer.removeEventListener("mouseup", onMouseUp);
    }
    currentContainer = el;
    if (el) {
      el.addEventListener("mouseup", onMouseUp);
      if (!documentMouseDownBound) {
        document.addEventListener("mousedown", onDocumentMouseDown);
        documentMouseDownBound = true;
      }
    }
  }

  function unbindContainer() {
    if (currentContainer) {
      currentContainer.removeEventListener("mouseup", onMouseUp);
    }
    if (documentMouseDownBound) {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      documentMouseDownBound = false;
    }
    currentContainer = null;
  }

  function dismissToolbar() {
    toolbarState.visible = false;
  }

  /**
   * Collect all text nodes whose content lies (partially) within the given Range.
   * Returns the segments in document order.
   */
  function collectTextNodesInRange(range: Range): TextNodeSegment[] {
    const segments: TextNodeSegment[] = [];
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    // Walk all text nodes within the common ancestor
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Node | null = walker.firstChild();
    while (node) {
      const textNode = node as Text;
      if (range.intersectsNode(textNode) && textNode.textContent) {
        let start = 0;
        let end = textNode.textContent.length;

        if (textNode === startContainer) {
          start = range.startOffset;
        }
        if (textNode === endContainer) {
          end = range.endOffset;
        }

        if (start < end) {
          segments.push({ node: textNode, start, end });
        }
      }
      node = walker.nextNode();
    }

    return segments;
  }

  /**
   * Wrap each text-node segment in a <mark> element.
   * Process in reverse order so earlier offsets remain valid.
   */
  /**
   * Wrap each text-node segment in a <mark> element.
   * Uses splitText twice to isolate the segment, then replaceChild
   * to swap in the <mark>.  Process in reverse so earlier offsets stay valid.
   */
  function wrapTextNodeSegments(segments: TextNodeSegment[], color: HighlightColor) {
    for (let i = segments.length - 1; i >= 0; i--) {
      const { node: textNode, start, end } = segments[i];
      const parent = textNode.parentNode;
      if (!parent) continue;

      // Split at end first (offset still valid because start < end)
      // textNode is [0, end), afterEnd is [end, ...)
      const afterEnd = textNode.splitText(end);

      // Split at start; textNode is now [0, start), toWrap is [start, end)
      const toWrap = textNode.splitText(start);

      // Replace toWrap with a <mark>
      const mark = document.createElement("mark");
      mark.className = `hl-${color}`;
      mark.textContent = toWrap.textContent;
      parent.replaceChild(mark, toWrap);
    }
  }

  function applyHighlight(color: HighlightColor) {
    if (!lastSelectionRange) return;

    try {
      const range = lastSelectionRange;

      // First, try the simple surroundContents (works for inline selections
      // that don't cross element boundaries)
      try {
        const mark = document.createElement("mark");
        mark.className = `hl-${color}`;
        range.surroundContents(mark);
        window.getSelection()?.removeAllRanges();
        dismissToolbar();
        return;
      } catch {
        // Cross-element selection — fall through to text-node walking
      }

      // General case: safe per-text-node wrapping
      const segments = collectTextNodesInRange(range);
      if (segments.length > 0) {
        wrapTextNodeSegments(segments, color);
      }

      window.getSelection()?.removeAllRanges();
    } catch {
      // ignore
    }
    dismissToolbar();
  }

  function clearHighlight() {
    if (!lastSelectionRange || !currentContainer) {
      dismissToolbar();
      return;
    }

    try {
      const range = lastSelectionRange;

      // Unwrap <mark> elements that intersect the saved range
      const marks = currentContainer.querySelectorAll("mark.hl-red, mark.hl-yellow, mark.hl-green");
      for (const mark of marks) {
        if (range.intersectsNode(mark)) {
          const parent = mark.parentNode;
          if (!parent) continue;
          while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
          }
          parent.removeChild(mark);
        }
      }

      window.getSelection()?.removeAllRanges();
    } catch {
      // ignore
    }
    dismissToolbar();
  }

  return {
    toolbarState,
    bindContainer,
    unbindContainer,
    applyHighlight,
    clearHighlight,
    dismissToolbar
  };
}
