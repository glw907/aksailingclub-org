---
title: "Welcome to the New Website"
date: 2026-02-27
description: "We've rebuilt the ASC website from the ground up on a new platform. We've been working on this since last fall, and it's finally live!"
tags:
  - club
---
We've rebuilt the ASC website from the ground up on a new platform. We've been working on this since last fall, and it's finally live!

## Design

The old site was a WordPress theme that we'd been stretching past its limits, especially on mobile. This is a completely different site built on a static site generator called [Hugo](https://gohugo.io/). But more important than any of the nerd stuff, the navigation has been reorganized, pages have all been cleaned up and prettified, and everything actually works well on phones. But with this many changes, I'm _sure_ that we still have bugs and content issues that I haven't caught. So, if you find something broken, use the [contact form](/contact/) and select "Website correction." There's also a rarely-used #technology channel on Discord, if you want to chat more directly about an issue.

## Content

We wrote a lot of new pages during the rebuild:

- **[New Member Guide](/members/new-member-guide/).** This section is a walkthrough of the club for new members: what to expect at your first visit, how the club is organized, your member account, how to get on the water, and where to go for help. If you joined in the last year or two, it's worth a read. New members automatically get pointed here, and this is effectively our digital "welcome letter."
- **[Visiting the Club](/members/visiting-the-club/).** This page is a quick and practical guide for planning a trip out to the club: what to pack, tent camping logistics, club boat reminders, and a list of ways to pitch in while you're there.
- **[Racing](/racing/).** The racing section has been substantially expanded with information for people who haven't raced before. We added explanations of how race day works, how scoring works, what the different fleets are, and the full season schedule.
- **[Events calendar](/events/).** The season's events are on the homepage now, pulled automatically from our event database. Individual event pages have details, location, and registration links where applicable.
- **[News archive](/posts/).** All club posts in one place, organized by year and browsable by topic. If you're looking for a specific race result or announcement, start here. (Just for you, Bart!)
- **Site search.** There's a search icon in the top navigation bar (magnifying glass). It searches across all pages and posts on the site.

We also rewrote and expanded the [Education](/education/), [Join](/join/), and [Members](/members/) sections. Most of the site's content is either new or substantially revised.

## Tools

We added several forms that handle things members used to do by email (or not at all):

- **[Member directory](/members/directory/).** A searchable directory of club members powered by the same MembershipWorks software we use for other member management stuff. Your listing is controlled from the Profile tab in your [member account](/members/my-account/). You can set yourself as visible, hidden, or partially visible.
- **[Issues & Support](/members/issues-and-support/).** One form for reporting boat problems, site issues, harbor concerns, billing questions, and reimbursement requests. You pick a category, describe the issue, and optionally attach a photo or receipt. The form routes your submission to the right people automatically (more on that below).
- **[Donate](/donate/).** A donation form for one-time gifts to the club. Payment is handled through Stripe, and you get an automatic receipt. Oh, and speaking of Stripe, we've ditched PayPal and switched to Stripe for all payment processing, including member signup. PayPal is pretty clunky.
- **[Contact](/contact/).** The contact form routes to the appropriate committee based on the category you select: membership inquiries go to the Membership Committee, class questions go to the Program Committee, feedback goes to the Board, and website corrections come to me.

## Where Issues Go

The [Issues & Support](/members/issues-and-support/) page has a directory at the top showing where each category routes. But since this is new, here's the full breakdown:

| Category | Goes to |
|----------|---------|
| Boats | #fleet on Discord → Fleet Committee |
| Site | #site on Discord → Site Committee |
| Harbor | #harbor on Discord → Harbor Committee |
| Billing question | Finance Committee (email) |
| Reimbursement | Finance Committee (email with your receipt attached) |
| General question | Membership Committee (email) |

The three infrastructure categories (boats, site, harbor) post directly to the corresponding Discord channel with an @mention to the responsible committee. So if you report a broken tiller, it shows up in #fleet and the Fleet Committee (aka Steve Ryan & friends) gets pinged.

For reimbursements, select "Request reimbursement," describe what the receipt is for (and mention the sponsoring committee if you know it), and attach a photo or scan of the receipt. It goes to the Finance Committee as an email with the receipt attached.

If you're on Discord, you can still report fleet, site, and harbor issues directly in those channels. The form is there for members who aren't on Discord or who prefer a form.

## Signup and Storage

We changed how membership signup and storage work.

**Joining the club**: [Sign up for an account](/join/) and you're a member. That account handles your membership, event registration, class signups, and directory listing. Storage is separate.

**Moorings**: Contact the Harbormaster. He'll check availability (or add you to the waitlist), get you set up, and send a Stripe payment link.

**RV parking, boat parking, and rack storage**: Contact the Site Committee Chair. Same process — they will check availability, get you set up, and send a payment link.

Previously, storage was bundled into the membership signup process, which meant you could only set it up when you created your account. Now that it's separate, you can add or change storage at any point during the season. Talk to the Harbormaster or Site Committee Chair through the [contact form](/contact/) or on Discord and they'll send you a payment link.

## Content Management

The old WordPress site had a steep learning curve for site editors. We now have a CMS called [Sveltia](https://github.com/sveltia/sveltia-cms) that is much easier to use, so if you're interested in helping maintain the site, [let me know](/contact/).

## Under the Hood

(For the nerds.) The site moved from WordPress on SiteGround shared hosting to Hugo on Cloudflare. Pages are pre-built HTML served from Cloudflare's edge network. Forms, the events calendar, and the issues routing all run on Cloudflare Workers, which are serverless functions that execute at the edge. Payment processing goes through Stripe. Transactional email (form confirmations, payment links) goes through Resend, a developer-focused email delivery service.

And yes, the whole thing — hosting, DNS, SSL, Workers — is free. Cloudflare handles roughly 20% of all web traffic and operates in over 330 cities worldwide. Their free tier isn't a loss leader: free customers use spare capacity on infrastructure that's already built for paying enterprise customers. We're a small sailing club website, so we fit comfortably within those limits. The money saved here can now be directed back to more direct mission-focused items.

## What's Next

We'll do deeper posts on a few of these topics over the coming weeks: the racing section, Issues & Support routing, the Visiting the Club guide, and the member directory. We'll also be filling in some content gaps and fixing issues as people find them.

If you spot a problem or have a suggestion, [contact form](/contact/) or [Discord](/members/discord-server/).
