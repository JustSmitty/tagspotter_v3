# Google Play closed testing — the 12-tester gate

This is the last thing standing between Tag Spotter and Play **production**, and it is the only item
in either store that cannot be finished by working harder. It is a recruitment problem with a
calendar attached.

## The rule, precisely

A personal Play developer account created after November 2023 cannot apply for production access
until a closed test has run with **12 or more testers opted in, continuously, for 14 days**.

Three details that decide whether the clock is actually running:

- **Being on the tester email list counts for nothing.** The list is an invitation. Each person must
  personally open <https://play.google.com/apps/testing/com.tagspotter.app> while signed into the
  Google account on the list, and accept. Until they do, they are not a tester.
- **The 14 days are continuous, and the threshold is a floor, not an average.** If the opted-in count
  drops below 12 — one person leaves the test, or switches Google account — the clock restarts from
  zero. Twelve is therefore the wrong target. Recruit fifteen or sixteen.
- **The counter is the source of truth.** Play Console → the app's Dashboard → "Apply for access to
  production" shows *"N testers currently opted-in"*. Read that number rather than counting invites
  sent; the two have been different for this app for weeks.

## Where it stands

Check the counter before doing anything else — it is the only number that matters, and this document
will go stale before it does. As of the last check it read **0**, with the closed track live and
serving builds correctly. The blocker has never been the build; it is that nobody has accepted.

## Recruiting, concretely

Twelve real people is a bigger ask than it sounds, and the failure mode is asking vaguely. What
works is naming the exact three steps and how long each takes.

**Who to ask.** Anyone with an Android phone and a Google account. They do not need to play the game
or give feedback for the count to hold — though feedback matters later, see the production
application below. Family, coworkers, group chats, a local hobby group. Twelve is about twenty asks.

**What to send them:**

> I've built a road-trip game for Android — you spot license plates from different states and collect
> all 50. I need 12 people on the test list before Google will let me publish it properly, and I'm
> short.
>
> It takes about two minutes:
>
> 1. Tell me the Gmail address on your Android phone so I can add you.
> 2. Once I say you're added, open this on the phone and tap "Become a tester":
>    <https://play.google.com/apps/testing/com.tagspotter.app>
> 3. Install it from the link on that page.
>
> One catch: please leave it installed and stay opted in for about three weeks. If people drop out,
> Google resets my 14-day clock and I start over.

Say the three-week part up front. Someone who opts out on day nine because they forgot why they had
it is more expensive than someone who never joined.

**Adding them.** Play Console → Testing → Closed testing → the *Alpha* track → Testers → the email
list. Note the trap recorded in the session notes: **one email list can be attached to more than one
track**, and the `Internal - device QA` list is on both internal and closed. A person on that list is
simultaneously an internal and a closed tester, which is why a device once received an older build
from the wrong track. Give closed testing its own list if that becomes confusing.

**Verifying.** After each batch, re-read the Dashboard counter. Do not trust "I did it" — a Gmail
address that differs from the one on their phone is the most common failure, and it looks identical
from your side.

## After the 14 days

Applying for production access is not a button. It is three sections of questions, and Google
reviews the answers for up to 7 days:

1. **About your closed test** — how you recruited, how many testers, what you asked them to do.
2. **About your app** — what it does, who it is for.
3. **Production readiness** — and this one requires **summarising real tester feedback and what you
   changed because of it**.

That last question is why the testing has to be genuine. Plan to actually ask the testers something
— even "did anything confuse you in the first two minutes?" — and keep the replies. Answering it from
an empty inbox is both obvious and a rejection risk.

## Why this is worth doing now

The iOS side is submitted and needs nothing further. The 14-day clock is the only remaining work in
either store that is purely elapsed time, so every day it has not started is a day added to the end.
Recruiting also solves a second problem for free: **the app has never run on an iPhone, and Play
testers are the same pool of people you would ask for a TestFlight install.**
