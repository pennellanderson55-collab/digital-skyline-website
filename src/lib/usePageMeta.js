import { useEffect } from 'react'

/**
 * Sets the document <title> and meta description for a route while it is
 * mounted, then restores the original homepage values on unmount.
 *
 * This is a client-side SPA, so per-page SEO tags are applied at runtime.
 * Crawlers that execute JS (Google) will pick these up; the static fallback
 * in index.html covers the rest.
 */
export default function usePageMeta({ title, description }) {
  useEffect(() => {
    const prevTitle = document.title
    const metaEl = document.querySelector('meta[name="description"]')
    const prevDescription = metaEl ? metaEl.getAttribute('content') : null

    if (title) document.title = title
    if (description && metaEl) metaEl.setAttribute('content', description)

    return () => {
      document.title = prevTitle
      if (metaEl && prevDescription !== null) {
        metaEl.setAttribute('content', prevDescription)
      }
    }
  }, [title, description])
}
