import { z } from 'zod';
export const AvatarStyleSchema = z.enum([
    'shadow',
    'cyber',
    'fantasy',
    'minimal',
    'toon',
    'mystic',
    'space',
    'samurai',
    'retro',
    'neon',
]);
export const VoicePreferenceSchema = z.enum([
    'voice_and_text',
    'text_only',
    'voice_only',
]);
export const CharacterNameSchema = z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(24, 'Name cannot exceed 24 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, hyphens, and underscores');
export const InterestTagSchema = z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform(val => val.toLowerCase());
export const RegisterAnonymousUserSchema = z.object({
    characterName: CharacterNameSchema.optional(),
    avatarStyle: AvatarStyleSchema.default('shadow'),
    interests: z.array(InterestTagSchema).max(20).default([]),
    bio: z.string().max(160, 'Bio cannot exceed 160 characters').default(''),
    voicePreference: VoicePreferenceSchema.default('voice_and_text'),
});
export const CreateRoomSchema = z.object({
    type: z.enum(['random', 'invite', 'nearby']).default('invite'),
    maxUsers: z.number().int().min(2).max(50).default(20),
    interests: z.array(InterestTagSchema).max(10).default([]),
});
export const JoinRoomSchema = z.object({
    roomCode: z.string().trim().min(4).max(12),
    inviteToken: z.string().optional(),
});
export const SendMessageSchema = z.object({
    content: z
        .string()
        .trim()
        .min(1, 'Message cannot be empty')
        .max(1000, 'Message cannot exceed 1000 characters'),
    replyToId: z.string().optional(),
});
export const ReportUserSchema = z.object({
    reportedPublicId: z.string().min(4).max(20),
    reason: z.enum([
        'harassment',
        'spam',
        'threats',
        'sexual_content',
        'hate_abuse',
        'impersonation',
        'other',
    ]),
    details: z.string().max(500).optional(),
    roomId: z.string().optional(),
    messageId: z.string().optional(),
});
export const BlockUserSchema = z.object({
    targetPublicId: z.string().min(4).max(20),
});
export const MatchQueueSchema = z.object({
    interests: z.array(InterestTagSchema).max(20),
    language: z.string().max(10).default('en'),
});
// Curated list of default interests
export const CURATED_INTERESTS = [
    'Anime',
    'Manga',
    'Manhwa',
    'Gaming',
    'Music',
    'Movies',
    'Technology',
    'Programming',
    'Fitness',
    'Books',
    'Art',
    'Travel',
    'Memes',
    'Sports',
    'Science',
    'Business',
    'Study',
    'Photography',
    'Cars',
    'Fashion',
    'Food',
    'Anime Music',
    'K-Pop',
    'Coding',
    'Startups',
    'Movies & Series',
    'Casual Talk',
    'Deep Conversations',
    'Friendship',
    'Language Exchange',
];
// Conversation starter suggestions when silent
export const CONVERSATION_STARTERS = [
    "What anime or series are you watching right now?",
    "What game could you play forever without getting bored?",
    "If you could live in any fictional universe, which one would it be?",
    "What's a song or album that completely shifts your mood?",
    "What project or obsession are you working on lately?",
    "Are you more into late-night deep talks or quick casual banter?",
    "If you had a superpower, what subtle daily perk would you want?",
];
