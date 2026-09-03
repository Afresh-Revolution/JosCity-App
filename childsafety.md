Implement Google Play Child Safety Standards compliance for the Joscity website and app.

First, inspect the existing project structure, routing system, design components, and reporting functionality. Reuse the current Joscity design system and do not unnecessarily replace existing code.

## 1. Public child-safety webpage

Create a publicly accessible webpage at:

https://joscity.com/child-safety

Requirements:

- It must work without authentication.
- It must be responsive and accessible on mobile and desktop.
- Use the existing Joscity header, footer, typography, colours, and branding.
- Add an appropriate page title and SEO metadata.
- Do not make it a PDF or editable public document.
- Add links to Joscity’s Privacy Policy, Terms of Service, and Community Guidelines where those pages exist.
- The contact email must be clickable using `mailto:child-safety@joscity.com`.
- Do not expose private administrative information.

Use the following policy content:

# Joscity Child Safety Standards

Joscity has zero tolerance for child sexual abuse and exploitation (CSAE) and child sexual abuse material (CSAM).

Users must not create, upload, share, request, promote, or distribute content that sexually exploits, abuses, or endangers children. Prohibited conduct includes grooming, sextortion, sexual trafficking, inappropriate sexual communication involving minors, and any visual depiction of a minor engaged in sexually explicit conduct.

Joscity reviews reports of suspected child exploitation and takes appropriate action. This may include removing content, restricting or permanently suspending accounts, preserving relevant information, and reporting confirmed CSAM to the National Center for Missing & Exploited Children or the appropriate regional law-enforcement authority, as required by applicable law.

Users can report prohibited content or behaviour through Joscity’s in-app reporting tools or by emailing child-safety@joscity.com.

If a child is in immediate danger, contact local emergency services or the appropriate law-enforcement authority.

Child-safety contact: child-safety@joscity.com

Last updated: August 2026

## 2. In-app safety reporting

Inspect the app and confirm whether users can report:

- Profiles
- Feed posts
- Comments
- Stories
- Reels and videos
- Messages or conversations
- Marketplace listings

Where reporting is missing, add a clearly visible “Report” action to the item’s existing overflow menu or safety menu.

The reporting flow should:

1. Let the user choose a reason.
2. Include “Child safety or sexual exploitation” as a prominent reason.
3. Allow an optional description.
4. Record the reported content type and content ID.
5. Record the reporter’s user ID.
6. Record the reported user’s ID when available.
7. Record the date and time.
8. Submit the report securely to the existing backend.
9. Show a clear success or failure message.
10. Prevent duplicate submissions caused by repeated tapping.
11. Never notify the reported user about who submitted the report.

Suggested report reasons:

- Child safety or sexual exploitation
- Nudity or sexual content
- Harassment or bullying
- Violence or dangerous content
- Hate speech
- Scam or fraud
- Spam
- Impersonation
- Illegal goods or activity
- Other

## 3. General safety-reporting entry

Add an accessible “Report a safety concern” option under the app’s Settings, Help, or Safety section.

It should allow users to submit a safety concern even when it is not connected to a specific post or profile. It may also provide a mail link to:

child-safety@joscity.com

The reporting option must be accessible from inside the app without requiring users to visit an external website first.

## 4. Administrative handling

If an admin moderation system already exists, integrate child-safety reports into it.

Child-safety reports should:

- Be clearly marked as high priority.
- Appear in the moderation queue.
- Include the relevant content and account references.
- Permit an authorized moderator to review the report.
- Support actions such as removing content, suspending an account, preserving necessary records, and recording internal notes.
- Restrict access to authorized moderators only.
- Avoid permanently displaying illegal imagery where a secure reference or restricted evidence record is more appropriate.

Do not create automated reports to law enforcement or external organizations without explicit authorization and an approved operational process. The system should support internal escalation to the designated child-safety contact.

## 5. Security and privacy

- Validate all report inputs on both the client and server.
- Require authentication for report submission where appropriate.
- Apply rate limiting and anti-spam protection.
- Do not place sensitive report contents in client logs or analytics.
- Escape or sanitize user-supplied text.
- Preserve existing authentication and authorization behaviour.
- Do not expose moderation endpoints publicly.
- Do not claim that a safety procedure exists unless it is actually implemented.

## 6. Verification

After implementation:

- Confirm `/child-safety` returns a successful page without authentication.
- Verify it works when opened directly and after a page refresh.
- Confirm the page contains the terms “Joscity,” “child sexual abuse and exploitation,” “CSAE,” “CSAM,” and `child-safety@joscity.com`.
- Test the page on mobile and desktop layouts.
- Test every implemented report action.
- Confirm successful reports reach the moderation backend.
- Confirm unauthorized users cannot access moderation data.
- Run the existing linting, type checking, and relevant tests.
- Report all files changed, tests performed, and anything that still requires manual configuration.

Do not change unrelated functionality. If the project already has equivalent reporting features, extend and reuse them rather than creating a second reporting system.