/** @jsx jsx */
import { jsx, css } from '@emotion/react';

import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  role?: string;
  // Accepted for drop-in compatibility with velocity-react usage; the
  // animation itself is CSS-only.
  enter?: unknown;
  leave?: unknown;
}

const SLIDE_DOWN_CSS = css`
  overflow: hidden;
  animation: registry-slide-down 250ms ease-out;

  @keyframes registry-slide-down {
    from {
      max-height: 0;
      opacity: 0;
    }
    to {
      max-height: 1200px;
      opacity: 1;
    }
  }
`;

/**
 * CSS replacement for velocity-react's VelocityTransitionGroup (which is
 * abandoned and incompatible with React 18). Children animate open when they
 * appear; there is no exit animation.
 */
export default function SlideTransitionGroup({ children, role }: Props) {
  if (!children) {
    return null;
  }

  return (
    <div css={SLIDE_DOWN_CSS} role={role}>
      {children}
    </div>
  );
}
