# Agent UI preview

Available in the native app and the Expo website build. Start at Welcome ? Create account ? Agents, or open `/register/agent` and `/agents` directly.

- Signup reuses the personal fields and offers both service selections. Preview navigation never calls registration or stores entered details.
- Dashboard, wallet and profile show labeled sample data. Availability, request filtering and expandable request cards are local UI state only.
- `/agents/feed` renders the existing HomeScreen for signed-in users, with agent navigation. Guests see the existing-login entry point. No alternative feed or agent authentication was added.
- Purple (`#8B5CF6`) is the verified-agent fallback badge color. Server-assigned badge colors remain authoritative; unverified accounts are not automatically verified.
- No agent backend, escrow, payment, matching, delivery tracking or account persistence is implemented.

Review on narrow mobile screens and wide browser windows, in light and dark appearance. Check both service selections, all four navigation tabs, request filters, and the signup preview with network requests inspected to confirm no registration submission.


## Service request UI

Explore and the business dashboard have Help me buy, Help me deliver and Agents quick actions. `/agent-services/request` keeps account navigation visible, accepts up to three local image selections, and offers public or direct recipients. `/agent-services/directory` uses sample agents sorted by rating, then completed jobs; pausing requests never hides or reorders an agent. Search includes name, category and bio.

The in-memory preview store resets on app reload. Public and John Musa direct requests appear on the agent dashboard. Other direct requests stay addressed to the selected sample agent; they are not reassigned to John. Accepting a preview request exposes sequential status controls: Accepted, Sourcing, Ready for delivery, Out for delivery, Delivered. Delivered moves to Completed. Ready for delivery from an agent without Help me buy shows a public handoff, with an explicit simulated pickup control. This follows the requested Help me buy handoff direction.

Customer request confirmation displays the assigned agent, progress and notification copy. Return to that screen after updating the job to see the preview state. No remote registration, uploads, dispatch, push notifications or persistence is implemented for agent services. Agent bio, categories, services and availability are editable in the preview profile; the sample John directory entry reflects them.
