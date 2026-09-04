/**
 * Demo / placeholder content for projects-app.
 *
 * Enable on deploy:
 *   SEED_DEMO=1
 *
 * Wipe demo data only (keeps real users):
 *   CLEAR_DEMO=1
 *
 * Both can be set together: CLEAR then SEED.
 * Idempotent: if demo users already exist, seed is skipped.
 *
 * Login: c1@mova.cms … c5@mova.cms
 * Password for each account = its own email
 *   e.g. c2@mova.cms  /  c2@mova.cms
 */
import { db } from "./index";
import {
  users,
  projects,
  projectMembers,
  forums,
  forumMembers,
  forumPosts,
  conversations,
  conversationMembers,
  messages,
  commits,
} from "./schema";
import { inArray, like, or } from "drizzle-orm";
import { hashPassword } from "../auth";

const DEMO_EMAILS = [
  "c1@mova.cms",
  "c2@mova.cms",
  "c3@mova.cms",
  "c4@mova.cms",
  "c5@mova.cms",
] as const;

/** Fixed IDs so cleanup is reliable across redeploys */
const U = {
  c1: "demo-user-c1",
  c2: "demo-user-c2",
  c3: "demo-user-c3",
  c4: "demo-user-c4",
  c5: "demo-user-c5",
} as const;

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
];

function now(offsetSec = 0) {
  return Math.floor(Date.now() / 1000) + offsetSec;
}

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export async function clearDemoData() {
  console.log("[seed-demo] clearing demo data…");

  const demoUserIds = Object.values(U);

  await db.delete(messages).where(like(messages.id, "demo-%"));
  await db.delete(conversationMembers).where(like(conversationMembers.id, "demo-%"));
  await db.delete(conversations).where(like(conversations.id, "demo-%"));

  await db.delete(forumPosts).where(like(forumPosts.id, "demo-%"));
  await db.delete(forumMembers).where(like(forumMembers.id, "demo-%"));
  await db.delete(forums).where(like(forums.id, "demo-%"));

  await db.delete(commits).where(like(commits.id, "demo-%"));
  await db.delete(projectMembers).where(like(projectMembers.id, "demo-%"));
  await db.delete(projects).where(like(projects.id, "demo-%"));

  await db
    .delete(users)
    .where(or(inArray(users.id, demoUserIds), inArray(users.email, [...DEMO_EMAILS])));

  console.log("[seed-demo] demo data cleared");
}

export async function seedDemoData() {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, [...DEMO_EMAILS]))
    .limit(1);

  if (existing.length > 0) {
    console.log("[seed-demo] demo users already present — skipping seed");
    return;
  }

  console.log("[seed-demo] seeding placeholder content…");
  const t0 = now(-86400 * 14);

  const hashes = await Promise.all(
    DEMO_EMAILS.map((email) => hashPassword(email))
  );

  const userRows = [
    {
      id: U.c1,
      email: "c1@mova.cms",
      name: "Chinedu Okonkwo",
      username: "chinedu_ok",
      passwordHash: hashes[0],
      avatarColor: COLORS[0],
      bio: "Software engineer & open-source advocate based in Enugu. Building tools for Nigerian researchers.",
      organization: "University of Nigeria, Nsukka",
      location: "Enugu, Nigeria",
      role: "user" as const,
      createdAt: t0,
    },
    {
      id: U.c2,
      email: "c2@mova.cms",
      name: "Aisha Bello",
      username: "aisha_bello",
      passwordHash: hashes[1],
      avatarColor: COLORS[1],
      bio: "Public health researcher focused on community outreach and digital health systems.",
      organization: "Ahmadu Bello University",
      location: "Zaria, Nigeria",
      role: "user" as const,
      createdAt: t0 + 3600,
    },
    {
      id: U.c3,
      email: "c3@mova.cms",
      name: "Emeka Nwosu",
      username: "emeka_nwosu",
      passwordHash: hashes[2],
      avatarColor: COLORS[2],
      bio: "Data scientist working on traffic & urban mobility models for Lagos.",
      organization: "University of Lagos",
      location: "Lagos, Nigeria",
      role: "user" as const,
      createdAt: t0 + 7200,
    },
    {
      id: U.c4,
      email: "c4@mova.cms",
      name: "Fatima Ibrahim",
      username: "fatima_ibrahim",
      passwordHash: hashes[3],
      avatarColor: COLORS[3],
      bio: "Linguist documenting endangered Nigerian languages and building digital archives.",
      organization: "Bayero University Kano",
      location: "Kano, Nigeria",
      role: "user" as const,
      createdAt: t0 + 10800,
    },
    {
      id: U.c5,
      email: "c5@mova.cms",
      name: "Tunde Adebayo",
      username: "tunde_adebayo",
      passwordHash: hashes[4],
      avatarColor: COLORS[4],
      bio: "AgriTech founder. Connecting smallholder farmers to markets and climate data.",
      organization: "FarmLink NG",
      location: "Ibadan, Nigeria",
      role: "user" as const,
      createdAt: t0 + 14400,
    },
  ];

  await db.insert(users).values(userRows);

  type ProjDef = {
    id: string;
    title: string;
    description: string;
    visibility: "public" | "private";
    owner: string;
    members: [string, string];
    snapshot: string;
  };

  const projectDefs: ProjDef[] = [
    {
      id: "demo-proj-01",
      title: "Naija Open Education Hub",
      description:
        "A collaborative workspace for open educational resources tailored to the Nigerian secondary and tertiary curriculum. We curate lesson plans, past questions, and video explainers.",
      visibility: "public",
      owner: U.c1,
      members: [U.c2, U.c3],
      snapshot:
        "<h1>Naija Open Education Hub</h1><p>Welcome to the shared workspace. Current focus: JAMB &amp; WAEC science subjects.</p><ul><li>Physics past questions 2018–2025</li><li>Chemistry practical guides</li><li>Biology diagram pack</li></ul>",
    },
    {
      id: "demo-proj-02",
      title: "Lagos Traffic Data Initiative",
      description:
        "Crowdsourced traffic and mobility data for Lagos metropolis. Goal is an open dataset that researchers and transport planners can use for modelling.",
      visibility: "public",
      owner: U.c3,
      members: [U.c1, U.c5],
      snapshot:
        "<h1>Lagos Traffic Data</h1><p>Sensor coverage map and weekly congestion indices. Please keep raw GPS traces private until anonymisation is complete.</p>",
    },
    {
      id: "demo-proj-03",
      title: "Yoruba Language Preservation Archive",
      description:
        "Digital archive of Yoruba oral histories, proverbs, and contemporary usage. Transcription guidelines and audio metadata live here.",
      visibility: "public",
      owner: U.c4,
      members: [U.c1, U.c2],
      snapshot:
        "<h1>Yoruba Archive</h1><p>Transcription conventions (v2) and speaker consent forms. New batch of Ibadan elder interviews uploaded last week.</p>",
    },
    {
      id: "demo-proj-04",
      title: "AgriTech Farmers Network",
      description:
        "Platform notes, crop calendars, and market-price scrapers for smallholder farmers across the South-West.",
      visibility: "public",
      owner: U.c5,
      members: [U.c3, U.c4],
      snapshot:
        "<h1>FarmLink Notes</h1><p>Cassava and maize price series for Oyo, Ogun, and Ondo. Next sprint: SMS alert templates in Yoruba and Pidgin.</p>",
    },
    {
      id: "demo-proj-05",
      title: "Campus Innovation Lab — UNILAG",
      description:
        "Student-led innovation lab projects: hardware prototypes, campus sustainability challenges, and industry mentorship logs.",
      visibility: "public",
      owner: U.c3,
      members: [U.c1, U.c5],
      snapshot:
        "<h1>Innovation Lab</h1><p>Spring cohort project briefs. Pitch day is 18 September — slide decks due one week prior.</p>",
    },
    {
      id: "demo-proj-06",
      title: "Renewable Energy Mapping Nigeria",
      description:
        "Open map layers for solar irradiance, mini-grid sites, and off-grid communities. Collaboration with rural electrification agencies.",
      visibility: "public",
      owner: U.c1,
      members: [U.c4, U.c5],
      snapshot:
        "<h1>RE Mapping</h1><p>Layer schema and attribution notes. Please do not publish exact mini-grid coordinates without clearance.</p>",
    },
    {
      id: "demo-proj-07",
      title: "Mental Health Peer Support Circle",
      description:
        "Private working space for peer facilitators running campus and community mental-health circles. Resources and session notes only.",
      visibility: "private",
      owner: U.c2,
      members: [U.c4, U.c1],
      snapshot:
        "<h1>Peer Support</h1><p>Confidential. Facilitation scripts and crisis referral list. Do not share outside the circle.</p>",
    },
    {
      id: "demo-proj-08",
      title: "Fintech Compliance Working Group",
      description:
        "Shared notes on CBN circulars, KYC/AML updates, and sandbox application experiences for Nigerian fintechs.",
      visibility: "public",
      owner: U.c5,
      members: [U.c1, U.c3],
      snapshot:
        "<h1>Compliance WG</h1><p>Summary of July 2026 circular on agent banking. Action items for member startups listed below.</p>",
    },
    {
      id: "demo-proj-09",
      title: "Community Health Outreach — North-West",
      description:
        "Planning docs, supply checklists, and post-visit reports for mobile clinic days in Kano and neighbouring states.",
      visibility: "public",
      owner: U.c2,
      members: [U.c4, U.c3],
      snapshot:
        "<h1>Outreach Log</h1><p>August Kano itinerary locked. Vaccination cold-chain checklist attached.</p>",
    },
    {
      id: "demo-proj-10",
      title: "Internal Product Roadmap (Private)",
      description:
        "Private product board for the core contributors. Feature prioritisation, OKRs, and release notes — not for public view.",
      visibility: "private",
      owner: U.c1,
      members: [U.c3, U.c5],
      snapshot:
        "<h1>Product Roadmap</h1><p>Q3 priorities: search ranking, forum moderation tools, and mobile-friendly editor. Keep discussions here.</p>",
    },
  ];

  for (const p of projectDefs) {
    const created = t0 + Math.floor(Math.random() * 86400 * 10);
    const slug = slugify(p.title);
    await db.insert(projects).values({
      id: p.id,
      slug,
      title: p.title,
      description: p.description,
      visibility: p.visibility,
      ownerId: p.owner,
      searchText: `${p.title} ${p.description}`,
      latestSnapshotHtml: p.snapshot,
      createdAt: created,
      updatedAt: created + 3600,
    });

    await db.insert(projectMembers).values({
      id: `demo-pm-${p.id}-owner`,
      projectId: p.id,
      userId: p.owner,
      role: "owner",
      color: COLORS[0],
      joinedAt: created,
    });

    for (let i = 0; i < 2; i++) {
      await db.insert(projectMembers).values({
        id: `demo-pm-${p.id}-m${i}`,
        projectId: p.id,
        userId: p.members[i],
        role: "editor",
        color: COLORS[(i + 1) % COLORS.length],
        joinedAt: created + 600 * (i + 1),
      });
    }

    await db.insert(commits).values({
      id: `demo-commit-${p.id}-1`,
      projectId: p.id,
      authorId: p.owner,
      message: "Initial outline and structure",
      plainText: p.snapshot.replace(/<[^>]+>/g, " ").slice(0, 400),
      html: p.snapshot,
      createdAt: created + 120,
    });
    await db.insert(commits).values({
      id: `demo-commit-${p.id}-2`,
      projectId: p.id,
      authorId: p.members[0],
      message: "Expanded notes and next steps",
      plainText: "Follow-up edits and task list.",
      html: "<p>Follow-up edits and task list added.</p>",
      createdAt: created + 3600,
    });
  }

  const forumDefs = [
    {
      id: "demo-forum-01",
      title: "General Discussion",
      description: "Open chat for everyone on the platform — intros, questions, and announcements.",
      visibility: "public" as const,
      owner: U.c1,
      members: [U.c1, U.c2, U.c3, U.c4, U.c5],
    },
    {
      id: "demo-forum-02",
      title: "Tech & Innovation Nigeria",
      description: "Startups, open-source, hardware, and digital public goods from across Nigeria.",
      visibility: "public" as const,
      owner: U.c3,
      members: [U.c1, U.c3, U.c5],
    },
    {
      id: "demo-forum-03",
      title: "Research Collaboration",
      description: "Finding co-authors, sharing datasets, and coordinating multi-institution projects.",
      visibility: "public" as const,
      owner: U.c2,
      members: [U.c2, U.c4, U.c1],
    },
    {
      id: "demo-forum-04",
      title: "Coordinators (Private)",
      description: "Private channel for project and forum moderators. Sensitive operational notes only.",
      visibility: "private" as const,
      owner: U.c1,
      members: [U.c1, U.c2, U.c3],
    },
  ];

  for (const f of forumDefs) {
    const created = t0 + 86400 * 2;
    await db.insert(forums).values({
      id: f.id,
      title: f.title,
      description: f.description,
      visibility: f.visibility,
      ownerId: f.owner,
      createdAt: created,
      updatedAt: created,
    });

    for (const uid of f.members) {
      await db.insert(forumMembers).values({
        id: `demo-fm-${f.id}-${uid}`,
        forumId: f.id,
        userId: uid,
        role: uid === f.owner ? "owner" : "member",
        joinedAt: created,
      });
    }
  }

  const posts: {
    id: string;
    forumId: string;
    authorId: string;
    body: string;
    createdAt: number;
    parentId?: string;
  }[] = [
    {
      id: "demo-post-01",
      forumId: "demo-forum-01",
      authorId: U.c1,
      body: "Welcome everyone 👋 This is the general space. Feel free to introduce yourself and what you're working on.",
      createdAt: t0 + 86400 * 2 + 100,
    },
    {
      id: "demo-post-02",
      forumId: "demo-forum-01",
      authorId: U.c2,
      body: "Hi all — Aisha here from Zaria. Working mostly on community health outreach and looking for people interested in digital tools for field teams.",
      createdAt: t0 + 86400 * 2 + 400,
    },
    {
      id: "demo-post-03",
      forumId: "demo-forum-01",
      authorId: U.c5,
      body: "Tunde from Ibadan. AgriTech side — happy to share market-price scrapers if anyone needs them for research.",
      createdAt: t0 + 86400 * 2 + 800,
    },
    {
      id: "demo-post-04",
      forumId: "demo-forum-02",
      authorId: U.c3,
      body: "Anyone building with open traffic or mobility data? We're cleaning a Lagos dataset and could use feedback on the schema before we publish.",
      createdAt: t0 + 86400 * 3,
    },
    {
      id: "demo-post-05",
      forumId: "demo-forum-02",
      authorId: U.c1,
      body: "Would love to see the schema. Also tagging the Renewable Energy Mapping group — there might be overlap with mini-grid site access data.",
      createdAt: t0 + 86400 * 3 + 600,
      parentId: "demo-post-04",
    },
    {
      id: "demo-post-06",
      forumId: "demo-forum-03",
      authorId: U.c4,
      body: "Looking for collaborators on a small grant application around Yoruba oral-history transcription tools. Happy to co-author if the methods fit your work.",
      createdAt: t0 + 86400 * 4,
    },
    {
      id: "demo-post-07",
      forumId: "demo-forum-03",
      authorId: U.c2,
      body: "Interesting — we have some experience with consent workflows for community interviews. Can share templates if useful.",
      createdAt: t0 + 86400 * 4 + 900,
      parentId: "demo-post-06",
    },
    {
      id: "demo-post-08",
      forumId: "demo-forum-04",
      authorId: U.c1,
      body: "Private note: please keep join-request approvals timely for the two private projects. Escalation path is this channel.",
      createdAt: t0 + 86400 * 5,
    },
    {
      id: "demo-post-09",
      forumId: "demo-forum-04",
      authorId: U.c2,
      body: "Noted. I'll handle Mental Health Peer Support requests this week.",
      createdAt: t0 + 86400 * 5 + 300,
      parentId: "demo-post-08",
    },
  ];

  for (const post of posts) {
    await db.insert(forumPosts).values({
      id: post.id,
      forumId: post.forumId,
      authorId: post.authorId,
      body: post.body,
      kind: "text",
      parentId: post.parentId ?? null,
      createdAt: post.createdAt,
    });
  }

  async function createDm(
    id: string,
    a: string,
    b: string,
    msgs: { author: string; body: string; at: number }[]
  ) {
    await db.insert(conversations).values({
      id,
      kind: "dm",
      title: "",
      createdAt: msgs[0]?.at ?? t0,
      updatedAt: msgs[msgs.length - 1]?.at ?? t0,
    });
    await db.insert(conversationMembers).values([
      {
        id: `${id}-m1`,
        conversationId: id,
        userId: a,
        lastReadAt: msgs[msgs.length - 1]?.at,
      },
      {
        id: `${id}-m2`,
        conversationId: id,
        userId: b,
        lastReadAt: msgs[msgs.length - 1]?.at,
      },
    ]);
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      await db.insert(messages).values({
        id: `${id}-msg-${i}`,
        conversationId: id,
        authorId: m.author,
        body: m.body,
        kind: "text",
        createdAt: m.at,
      });
    }
  }

  await createDm("demo-conv-01", U.c1, U.c3, [
    {
      author: U.c1,
      body: "Emeka, did you get a chance to look at the traffic schema draft?",
      at: t0 + 86400 * 6,
    },
    {
      author: U.c3,
      body: "Yes — left a couple of comments on the project. Main thing is the anonymisation window for GPS traces.",
      at: t0 + 86400 * 6 + 400,
    },
    {
      author: U.c1,
      body: "Perfect, I'll adjust the retention note today.",
      at: t0 + 86400 * 6 + 700,
    },
  ]);

  await createDm("demo-conv-02", U.c2, U.c4, [
    {
      author: U.c2,
      body: "Fatima, the consent templates you mentioned would be really helpful for our next outreach batch.",
      at: t0 + 86400 * 7,
    },
    {
      author: U.c4,
      body: "I'll drop the latest version in Research Collaboration and also share a copy here.",
      at: t0 + 86400 * 7 + 500,
    },
  ]);

  await createDm("demo-conv-03", U.c5, U.c1, [
    {
      author: U.c5,
      body: "Quick one — can we get the private product board updated with the SMS alert milestone?",
      at: t0 + 86400 * 8,
    },
    {
      author: U.c1,
      body: "Done. Also moved the search ranking item into this sprint.",
      at: t0 + 86400 * 8 + 200,
    },
  ]);

  console.log("[seed-demo] done — 5 users, 10 projects, 4 forums, messages");
  console.log("[seed-demo] login: email = password for each account");
  console.log("[seed-demo]   e.g. c2@mova.cms  /  c2@mova.cms");
}

export async function runDemoSeedFromEnv() {
  try {
    if (process.env.CLEAR_DEMO === "1") {
      await clearDemoData();
    }
    if (process.env.SEED_DEMO === "1") {
      await seedDemoData();
    }
  } catch (e) {
    console.error("[seed-demo] failed:", e);
  }
}
