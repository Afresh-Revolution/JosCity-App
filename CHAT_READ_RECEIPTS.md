# Chat read receipts

The mobile thread shows `Seen` under outgoing messages confirmed by the API. It refreshes every five seconds while focused and active, and acknowledges reads after rendering a successful fetch. Opening the inbox or sending a message does not acknowledge reads.

The backend is not included in this repository. To enable receipts, `GET /chat/conversations/:id` must return either:

- `seen: true` on a message, meaning the recipient has read that message, or
- `last_read_message_id` (or `lastReadMessageId`) on the other participant in `participants` for a direct conversation. This is a monotonic message-ID cursor within that conversation.

The existing authenticated `POST /chat/conversations/:id/read` must persist the caller's read cursor, validate membership, and expose it to the other participant on subsequent GETs. It should acknowledge only messages returned by the preceding fetch, rather than messages arriving afterward; the server can track the last delivered message ID per caller. Without receipt metadata, the app deliberately shows no Seen label.

Verify with two accounts: send a message while the recipient is outside the thread (no Seen), open the recipient's thread (Seen within the next refresh), send another message with the recipient away (new message remains unseen), and background the recipient's app (no additional read acknowledgments).
