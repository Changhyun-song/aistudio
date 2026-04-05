// ── Enums & Constants ────────────────────────────────

export type ProjectMode = 'midjourney_manual' | 'characterizer_40' | 'story_studio';
export type ProjectStatus = 'draft' | 'prompting' | 'selecting' | 'expanding' | 'curating' | 'complete';
export type Gender = 'male' | 'female' | 'neutral';
export type PromptStrength = 'conservative' | 'medium' | 'strong';
export type CandidateStatus = 'pending' | 'uploaded' | 'selected' | 'rejected';
export type VariantStatus = 'pending' | 'sent' | 'uploaded' | 'keep' | 'reject' | 'maybe';
export type CharacterizerShotStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type SelectionState = 'unreviewed' | 'keep' | 'maybe' | 'reject';

// ── Fixed 20-Shot Template ───────────────────────────

export const TWENTY_SHOTS = [
  { slot: 1,  key: 'base_portrait',           label: 'Base Portrait',                 desc: 'clean neutral portrait, front-facing, shoulders visible, plain light background' },
  { slot: 2,  key: 'front_portrait',          label: 'Front Portrait',                desc: 'front portrait, direct eye contact, soft studio lighting, plain background' },
  { slot: 3,  key: 'three_quarter',           label: 'Three-Quarter Portrait',        desc: 'three-quarter angle portrait, slightly turned, gentle lighting' },
  { slot: 4,  key: 'left_side_profile',       label: 'Left Side Profile',             desc: 'left side profile, face turned 90 degrees left, sharp jawline visible' },
  { slot: 5,  key: 'right_side_profile',      label: 'Right Side Profile',            desc: 'right side profile, face turned 90 degrees right' },
  { slot: 6,  key: 'half_body',               label: 'Half Body Portrait',            desc: 'half body portrait, waist up, relaxed standing posture, simple background' },
  { slot: 7,  key: 'full_body_standing',      label: 'Full Body Standing',            desc: 'full body standing shot, head to toe visible, neutral pose, plain background' },
  { slot: 8,  key: 'classroom_desk',          label: 'Classroom Desk Shot',           desc: 'sitting at a classroom desk, chin resting on hand, warm indoor light, desks and chalkboard softly blurred behind' },
  { slot: 9,  key: 'classroom_window',        label: 'Classroom Window Shot',         desc: 'standing by classroom window, natural sunlight streaming in, gazing outside, soft golden hour tones' },
  { slot: 10, key: 'hallway_walking',         label: 'Hallway Walking Shot',          desc: 'walking through school hallway, mid-stride, natural posture, lockers and windows blurred' },
  { slot: 11, key: 'just_woke_up',            label: 'Just-Woke-Up Close-Up',         desc: 'close-up, drowsy half-open eyes, slightly messy hair, soft morning light' },
  { slot: 12, key: 'surprised_reaction',      label: 'Surprised Reaction Close-Up',   desc: 'close-up, surprised expression, wide eyes, slightly open mouth, bright lighting' },
  { slot: 13, key: 'soft_smile',              label: 'Soft Smile Portrait',           desc: 'portrait, gentle natural smile, warm soft lighting, eyes slightly squinted' },
  { slot: 14, key: 'school_stairs',           label: 'School Stairs Sitting Shot',    desc: 'sitting on school stairs, legs relaxed, elbows on knees, natural light from above' },
  { slot: 15, key: 'library',                 label: 'Library Shot',                  desc: 'in a school library, bookshelves behind, seated, calm focused expression, warm lighting' },
  { slot: 16, key: 'rooftop',                 label: 'Rooftop Shot',                  desc: 'on school rooftop, sky and clouds behind, wind slightly blowing hair, upper body framing' },
  { slot: 17, key: 'rainy_window',            label: 'Rainy Window Mood Shot',        desc: 'beside a rain-streaked window, reflective mood, soft blue-grey tones, close-up' },
  { slot: 18, key: 'after_school_casual',     label: 'After-School Casual Shot',      desc: 'casual after-school outfit, relaxed posture, urban outdoor background softly blurred' },
  { slot: 19, key: 'full_body_reference',     label: 'Full Body Neutral Reference',   desc: 'full body standing, neutral expression, arms at sides, clean white or light grey background, reference sheet style' },
  { slot: 20, key: 'dramatic_closeup',        label: 'Dramatic Close-Up',             desc: 'extreme close-up, sharp focus on eyes and face, dramatic cinematic lighting, shallow depth of field' },
] as const;

export type ShotKey = (typeof TWENTY_SHOTS)[number]['key'];

// ── Data Models ──────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string;
  mode: ProjectMode;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface CharacterBrief {
  id: string;
  project_id: string;
  natural_input: string;
  name: string;
  gender: Gender;
  age_group: string;
  face_keywords: string;
  hairstyle: string;
  hair_color: string;
  body_type: string;
  mood: string;
  personality: string;
  signature_item: string;
  signature_color: string;
  uniform_style: string;
  casual_style: string;
  negative_prompts: string;
  prompt_strength: PromptStrength;
  created_at: string;
  updated_at: string;
}

export interface PromptRevision {
  id: string;
  project_id: string;
  version: number;
  prompt: string;
  user_feedback: string;
  ai_note: string;
  created_at: string;
}

export interface CandidateImage {
  id: string;
  project_id: string;
  revision_id: string;
  image_url: string;
  image_path: string;
  status: CandidateStatus;
  is_base: boolean;
  memo: string;
  created_at: string;
}

export interface BaseCharacter {
  id: string;
  project_id: string;
  candidate_id: string;
  summary: string;
  base_prompt: string;
  created_at: string;
}

export interface VariantPrompt {
  id: string;
  project_id: string;
  base_character_id: string;
  slot: number;
  shot_key: ShotKey;
  label: string;
  prompt: string;
  status: VariantStatus;
  image_url: string;
  image_path: string;
  quality_notes: string;
  created_at: string;
  updated_at: string;
}

export interface DatasetMetadata {
  character_name: string;
  concept: string;
  base_prompt: string;
  base_image: string;
  total_images: number;
  shots: { slot: number; key: string; label: string; image: string }[];
  notes: string;
  created_at: string;
}

export interface QualityCheck {
  face_consistent: boolean;
  high_resolution: boolean;
  style_consistent: boolean;
  no_extra_people: boolean;
  no_text_overlay: boolean;
  good_lighting: boolean;
  has_full_body: boolean;
  has_side_views: boolean;
  has_emotions: boolean;
}

// ── Fixed 40-Shot Template (Characterizer) ───────────

export const FORTY_SHOTS = [
  { slot: 1,  key: '01_base_portrait',              label: 'Base Portrait',              desc: 'clean neutral portrait, front-facing, shoulders visible, plain light background' },
  { slot: 2,  key: '02_front_portrait',             label: 'Front Portrait',             desc: 'front portrait, direct eye contact, soft studio lighting, plain background' },
  { slot: 3,  key: '03_three_quarter_left',         label: 'Three-Quarter Left',         desc: 'three-quarter angle portrait turned slightly left, gentle lighting' },
  { slot: 4,  key: '04_three_quarter_right',        label: 'Three-Quarter Right',        desc: 'three-quarter angle portrait turned slightly right, soft lighting' },
  { slot: 5,  key: '05_left_profile',               label: 'Left Profile',               desc: 'left side profile, face turned 90 degrees left, sharp jawline visible' },
  { slot: 6,  key: '06_right_profile',              label: 'Right Profile',              desc: 'right side profile, face turned 90 degrees right' },
  { slot: 7,  key: '07_half_body_neutral',          label: 'Half Body Neutral',          desc: 'half body portrait, waist up, relaxed standing posture, simple background' },
  { slot: 8,  key: '08_full_body_neutral',          label: 'Full Body Neutral',          desc: 'full body standing, head to toe, neutral pose, plain background' },
  { slot: 9,  key: '09_full_body_front',            label: 'Full Body Front',            desc: 'full body standing shot, facing directly forward, arms naturally at sides' },
  { slot: 10, key: '10_full_body_back',             label: 'Full Body Back',             desc: 'full body from behind, standing naturally, back of head and body visible' },
  { slot: 11, key: '11_over_shoulder_back',         label: 'Over Shoulder Back',         desc: 'over-the-shoulder view from behind, slight head turn, looking back softly' },
  { slot: 12, key: '12_sitting_classroom_desk',     label: 'Sitting Classroom Desk',     desc: 'sitting at a classroom desk, chin resting on hand, warm indoor light, desks blurred behind' },
  { slot: 13, key: '13_standing_classroom',         label: 'Standing Classroom',         desc: 'standing in a classroom, chalkboard behind, natural posture, warm light' },
  { slot: 14, key: '14_classroom_window',           label: 'Classroom Window',           desc: 'standing by classroom window, natural sunlight streaming in, gazing outside' },
  { slot: 15, key: '15_hallway_walking',            label: 'Hallway Walking',            desc: 'walking through school hallway, mid-stride, natural posture, lockers blurred' },
  { slot: 16, key: '16_hallway_standing',           label: 'Hallway Standing',           desc: 'standing in school hallway, leaning slightly against wall, calm expression' },
  { slot: 17, key: '17_school_stairs_sitting',      label: 'School Stairs Sitting',      desc: 'sitting on school stairs, legs relaxed, elbows on knees, natural light from above' },
  { slot: 18, key: '18_library_reading',            label: 'Library Reading',            desc: 'in school library, bookshelves behind, reading a book, calm focused expression' },
  { slot: 19, key: '19_rooftop_day',                label: 'Rooftop Day',                desc: 'on school rooftop, bright sky and clouds behind, wind slightly blowing hair' },
  { slot: 20, key: '20_rooftop_windy',              label: 'Rooftop Windy',              desc: 'on school rooftop, strong wind blowing hair and clothes, dramatic sky' },
  { slot: 21, key: '21_rainy_window_mood',          label: 'Rainy Window Mood',          desc: 'beside rain-streaked window, reflective mood, soft blue-grey tones, close-up' },
  { slot: 22, key: '22_after_school_casual',        label: 'After School Casual',        desc: 'casual after-school outfit, relaxed posture, urban outdoor background blurred' },
  { slot: 23, key: '23_after_school_hoodie',        label: 'After School Hoodie',        desc: 'wearing a hoodie, casual and relaxed, hands in pockets, soft outdoor light' },
  { slot: 24, key: '24_soft_smile_closeup',         label: 'Soft Smile Closeup',         desc: 'close-up portrait, gentle natural smile, warm soft lighting, eyes slightly squinted' },
  { slot: 25, key: '25_surprised_reaction',         label: 'Surprised Reaction',         desc: 'close-up, surprised expression, wide eyes, slightly open mouth, bright lighting' },
  { slot: 26, key: '26_serious_expression',         label: 'Serious Expression',         desc: 'portrait, serious focused expression, strong eye contact, neutral lighting' },
  { slot: 27, key: '27_determined_expression',      label: 'Determined Expression',      desc: 'portrait, determined expression, slight frown, intense eyes, dramatic lighting' },
  { slot: 28, key: '28_tired_expression',           label: 'Tired Expression',           desc: 'close-up, tired drowsy expression, half-open eyes, soft morning light' },
  { slot: 29, key: '29_laughing_expression',        label: 'Laughing Expression',        desc: 'portrait, genuine laughing expression, eyes closed with joy, bright warm lighting' },
  { slot: 30, key: '30_looking_down',               label: 'Looking Down',               desc: 'portrait, looking down thoughtfully, eyelashes visible, soft top lighting' },
  { slot: 31, key: '31_looking_up',                 label: 'Looking Up',                 desc: 'portrait, looking upward, hopeful expression, natural light from above' },
  { slot: 32, key: '32_hand_on_cheek',              label: 'Hand on Cheek',              desc: 'portrait, hand resting on cheek, contemplative expression, soft lighting' },
  { slot: 33, key: '33_holding_bag',                label: 'Holding Bag',                desc: 'half body, holding school bag on one shoulder, walking pose, natural outdoor light' },
  { slot: 34, key: '34_holding_book',               label: 'Holding Book',               desc: 'half body, holding a book against chest, gentle expression, warm indoor light' },
  { slot: 35, key: '35_uniform_reference_clean',    label: 'Uniform Reference Clean',    desc: 'full body standing, school uniform clearly visible, neutral pose, clean white background, reference style' },
  { slot: 36, key: '36_cardigan_reference',         label: 'Cardigan Reference',         desc: 'full body standing, wearing cardigan over uniform, clean background, reference style' },
  { slot: 37, key: '37_shoe_and_silhouette_full_body', label: 'Shoe & Silhouette',       desc: 'full body from head to shoes, silhouette-like framing, clean background' },
  { slot: 38, key: '38_low_angle_full_body',        label: 'Low Angle Full Body',        desc: 'full body from low angle looking up, dramatic perspective, sky background' },
  { slot: 39, key: '39_high_angle_portrait',        label: 'High Angle Portrait',        desc: 'portrait from high angle looking down at face, natural top lighting' },
  { slot: 40, key: '40_dramatic_closeup_02',        label: 'Dramatic Closeup 02',        desc: 'extreme close-up, sharp focus on eyes and face, dramatic cinematic lighting, shallow depth of field' },
] as const;

export type FortyShotKey = (typeof FORTY_SHOTS)[number]['key'];

// ── Characterizer Data Models ────────────────────────

export interface CharacterizerConfig {
  id: string;
  project_id: string;
  base_image_path: string;
  character_name: string;
  signature_item: string;
  signature_color: string;
  school_style: string;
  after_school_style: string;
  tone_keywords: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterizerAnchor {
  id: string;
  project_id: string;
  anchor_key: string;
  label: string;
  prompt_used: string;
  file_path: string;
  status: CharacterizerShotStatus;
  created_at: string;
}

export interface CharacterizerShot {
  id: string;
  project_id: string;
  shot_key: FortyShotKey;
  shot_index: number;
  label: string;
  prompt_used: string;
  provider: string;
  provider_model: string;
  file_path: string;
  status: CharacterizerShotStatus;
  selection_state: SelectionState;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export const ANCHOR_SHOTS = [
  { key: 'anchor_01_front_upper', label: 'Anchor — Front Upper Body', desc: 'front-facing upper body portrait, clean neutral background, clear face details' },
  { key: 'anchor_02_full_body', label: 'Anchor — Full Body', desc: 'full body standing, head to toe visible, neutral pose, clean background' },
  { key: 'anchor_03_three_quarter', label: 'Anchor — Three-Quarter', desc: 'three-quarter angle portrait, gentle lighting, natural expression' },
  { key: 'anchor_04_side_profile', label: 'Anchor — Side Profile', desc: 'side profile, face turned 90 degrees, sharp details visible' },
] as const;

export const DEFAULT_BRIEF: Omit<CharacterBrief, 'id' | 'project_id' | 'created_at' | 'updated_at'> = {
  natural_input: '',
  name: '',
  gender: 'female',
  age_group: 'Korean high school student, age 17-18',
  face_keywords: '',
  hairstyle: '',
  hair_color: '',
  body_type: '',
  mood: '',
  personality: '',
  signature_item: '',
  signature_color: '',
  uniform_style: 'modest Korean school uniform, blazer, white shirt, tie',
  casual_style: '',
  negative_prompts: 'nsfw, nude, deformed, ugly, blurry, low quality, extra limbs, extra fingers, watermark, text, logo, signature, multiple people, extra people',
  prompt_strength: 'medium',
};

// ── Story Studio: Project Constraints (Genre Overlay) ──

export type GenreTag = 'drama' | 'sf' | 'thriller' | 'comedy' | 'romance' | 'action' | 'mystery' | 'fantasy' | 'school' | 'creature';
export type LevelOption = 'none' | 'low' | 'medium' | 'high';
export type TwistLevel = 'low' | 'medium' | 'high' | 'extreme';
export type EndingType = 'happy' | 'bittersweet' | 'tragic' | 'unresolved';
export type ToggleOption = 'none' | 'optional' | 'required';
export type CompositionRule = 'all_female' | 'all_male' | 'mixed' | 'unspecified' | 'female_lead' | 'male_lead';
export type AgeGroup = 'high_school' | 'college' | 'adult' | 'mixed' | 'unspecified';
export type SettingRegion = 'korea' | 'japan' | 'global' | 'fantasy_world' | 'custom';
export type StoryCentralAxis = 'character' | 'mystery' | 'action' | 'romance' | 'relationship' | 'twist' | 'ensemble' | 'unspecified';

export const COMPOSITION_RULES: { key: CompositionRule; label: string }[] = [
  { key: 'unspecified', label: 'AI 결정' },
  { key: 'all_female', label: '전원 여성' },
  { key: 'all_male', label: '전원 남성' },
  { key: 'mixed', label: '혼성' },
  { key: 'female_lead', label: '여성 중심 (혼성 허용)' },
  { key: 'male_lead', label: '남성 중심 (혼성 허용)' },
];

export const CENTRAL_AXES: { key: StoryCentralAxis; label: string; desc: string }[] = [
  { key: 'unspecified', label: 'AI 결정', desc: 'AI가 장르/톤에 맞게 자동 결정' },
  { key: 'character', label: '캐릭터 중심', desc: '인물의 성장·변화가 스토리를 이끄는 구조' },
  { key: 'mystery', label: '미스터리 중심', desc: '비밀과 진실 추적이 핵심 동력' },
  { key: 'action', label: '액션 중심', desc: '사건·전투·긴장감이 이끄는 구조' },
  { key: 'romance', label: '로맨스 중심', desc: '감정선과 관계 전개가 핵심' },
  { key: 'relationship', label: '관계성 중심', desc: '팀/그룹 간 유대와 갈등이 축' },
  { key: 'twist', label: '반전 중심', desc: '구조적 뒤집기가 스토리의 핵심 장치' },
  { key: 'ensemble', label: '앙상블 중심', desc: '다인물 균형 시점 배분' },
];

export interface GenreOverlay {
  genre_stack: GenreTag[];
  tone: string;
  world_mode: string;
  romance_level: LevelOption;
  mystery_level: LevelOption;
  action_level: LevelOption;
  tragedy_level: LevelOption;
  twist_level: TwistLevel;
  ending_type: EndingType;
  death_event: ToggleOption;
  creature_usage: ToggleOption;
  power_system_usage: ToggleOption;
  target_audience: string;
  protagonist_count: number;
  protagonist_composition: CompositionRule;
  cast_total_limit: number;
  supporting_cast_min: number;
  supporting_cast_max: number;
  setting_region: SettingRegion;
  setting_region_custom: string;
  age_group: AgeGroup;
  story_central_axis: StoryCentralAxis;
  must_have_elements: string[];
  nice_to_have_elements: string[];
  forbidden_elements: string[];
  required_character_types: string[];
  optional_character_types: string[];
  episode_count: number;
  runtime_per_episode: number;
  /** @deprecated use protagonist_composition */
  protagonist_gender_rule?: CompositionRule;
}

export const GENRE_TAGS: { key: GenreTag; label: string }[] = [
  { key: 'drama', label: '드라마' },
  { key: 'sf', label: 'SF' },
  { key: 'thriller', label: '스릴러' },
  { key: 'comedy', label: '코미디' },
  { key: 'romance', label: '로맨스' },
  { key: 'action', label: '액션' },
  { key: 'mystery', label: '미스터리' },
  { key: 'fantasy', label: '판타지' },
  { key: 'school', label: '학원물' },
  { key: 'creature', label: '크리처물' },
];

export const DEFAULT_GENRE_OVERLAY: GenreOverlay = {
  genre_stack: [],
  tone: '',
  world_mode: '',
  romance_level: 'medium',
  mystery_level: 'medium',
  action_level: 'medium',
  tragedy_level: 'low',
  twist_level: 'medium',
  ending_type: 'happy',
  death_event: 'none',
  creature_usage: 'none',
  power_system_usage: 'none',
  target_audience: '',
  protagonist_count: 0,
  protagonist_composition: 'unspecified',
  cast_total_limit: 10,
  supporting_cast_min: 2,
  supporting_cast_max: 5,
  setting_region: 'korea',
  setting_region_custom: '',
  age_group: 'unspecified',
  story_central_axis: 'unspecified',
  must_have_elements: [],
  nice_to_have_elements: [],
  forbidden_elements: [],
  required_character_types: [],
  optional_character_types: [],
  episode_count: 10,
  runtime_per_episode: 5,
};

export interface GenrePreset {
  key: string;
  label: string;
  description: string;
  overlay: GenreOverlay;
}

const BASE: GenreOverlay = { ...DEFAULT_GENRE_OVERLAY };

export const GENRE_PRESETS: GenrePreset[] = [
  {
    key: 'youth_drama', label: 'Youth Drama', description: '감정과 성장 중심의 청춘 드라마',
    overlay: { ...BASE, genre_stack: ['drama', 'school'], tone: '감성적, 따뜻하면서도 쓸쓸한', world_mode: '현실', romance_level: 'medium', mystery_level: 'low', action_level: 'none', tragedy_level: 'medium', ending_type: 'bittersweet', age_group: 'high_school', target_audience: '10대 후반~20대 초반', story_central_axis: 'character' },
  },
  {
    key: 'school_sf_thriller', label: 'School SF Thriller', description: '학교 배경 SF + 스릴러',
    overlay: { ...BASE, genre_stack: ['sf', 'thriller', 'school'], tone: '긴장감, 미스터리', world_mode: '학교 + SF', romance_level: 'low', mystery_level: 'high', action_level: 'medium', tragedy_level: 'medium', twist_level: 'high', ending_type: 'bittersweet', death_event: 'optional', age_group: 'high_school', target_audience: '10대 후반~20대', story_central_axis: 'mystery' },
  },
  {
    key: 'school_hero_action', label: 'School Hero Action', description: '학교 히어로 + 괴물 + 팀 액션',
    overlay: { ...BASE, genre_stack: ['action', 'school', 'creature', 'drama'], tone: '뜨거운 액션 + 팀 케미', world_mode: '학교 + 초능력 + 괴물', protagonist_count: 5, protagonist_composition: 'all_female', supporting_cast_min: 3, supporting_cast_max: 5, romance_level: 'medium', mystery_level: 'medium', action_level: 'high', tragedy_level: 'medium', twist_level: 'high', death_event: 'required', creature_usage: 'required', power_system_usage: 'required', age_group: 'high_school', target_audience: '10대 후반~20대 초반', story_central_axis: 'action', required_character_types: ['quiet strategist', 'hot-headed fighter', 'emotional anchor'], optional_character_types: ['romance obsessed flirt', 'hidden strongest member'] },
  },
  {
    key: 'mystery_romance', label: 'Mystery Romance', description: '미스터리 속 로맨스',
    overlay: { ...BASE, genre_stack: ['mystery', 'romance', 'drama'], tone: '몽환적, 의심과 끌림', world_mode: '현실 기반', romance_level: 'high', mystery_level: 'high', twist_level: 'high', action_level: 'none', tragedy_level: 'low', target_audience: '20대', story_central_axis: 'romance' },
  },
  {
    key: 'dark_fantasy', label: 'Dark Fantasy', description: '어두운 세계관, 마법과 대가',
    overlay: { ...BASE, genre_stack: ['fantasy', 'drama', 'action'], tone: '어두움, 장엄', world_mode: '판타지 세계', setting_region: 'fantasy_world', romance_level: 'low', mystery_level: 'medium', action_level: 'high', tragedy_level: 'high', twist_level: 'high', ending_type: 'bittersweet', death_event: 'required', creature_usage: 'optional', power_system_usage: 'required', target_audience: '20대~30대', age_group: 'adult', story_central_axis: 'twist' },
  },
  {
    key: 'comedy_slice_of_life', label: 'Comedy Slice-of-Life', description: '일상 코미디, 유머와 관계',
    overlay: { ...BASE, genre_stack: ['comedy', 'school', 'romance'], tone: '유머러스, 가볍고 따뜻한', world_mode: '현실', romance_level: 'medium', mystery_level: 'none', action_level: 'none', tragedy_level: 'none', twist_level: 'low', age_group: 'high_school', target_audience: '전연령', story_central_axis: 'relationship' },
  },
  {
    key: 'creature_survival', label: 'Creature Survival', description: '크리처 서바이벌, 공포와 생존',
    overlay: { ...BASE, genre_stack: ['creature', 'thriller', 'action'], tone: '공포, 긴장, 서바이벌', world_mode: '격리 환경', romance_level: 'none', mystery_level: 'medium', action_level: 'high', tragedy_level: 'high', twist_level: 'high', ending_type: 'bittersweet', death_event: 'required', creature_usage: 'required', target_audience: '20대~30대', age_group: 'adult', story_central_axis: 'action' },
  },
  {
    key: 'ensemble_team_drama', label: 'Ensemble Team Drama', description: '팀 중심 감정 드라마, 유대와 갈등',
    overlay: { ...BASE, genre_stack: ['drama', 'school'], tone: '감동적, 눈물과 웃음', world_mode: '현실', romance_level: 'low', tragedy_level: 'medium', age_group: 'high_school', target_audience: '10대~20대', death_event: 'optional', story_central_axis: 'ensemble', protagonist_count: 5, supporting_cast_min: 3 },
  },
];

// ── Story Studio Data Models ─────────────────────────

export interface StoryCharacter {
  id: string;
  project_id: string;
  name: string;
  role: string;
  traits: string;
  signature_item: string;
  signature_color: string;
  speech_style: string;
  emotional_weakness: string;
  power_or_specialty: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StorySeriesBible {
  id: string;
  project_id: string;
  title: string;
  genre: string;
  tone: string;
  world_rules: string;
  season_goal: string;
  core_conflict: string;
  ending_direction: string;
  audience: string;
  reference_mood: string;
  raw_json: string;
  created_at: string;
  updated_at: string;
}

export interface StoryEpisodeArc {
  id: string;
  project_id: string;
  episode_number: number;
  title: string;
  purpose: string;
  summary: string;
  beginning: string;
  middle: string;
  climax: string;
  ending_hook: string;
  key_characters: string;
  raw_json: string;
  created_at: string;
  actionFormat?: string;
}

export interface StoryEpisodeScript {
  id: string;
  project_id: string;
  episode_number: number;
  markdown: string;
  scenes_json: string;
  created_at: string;
}

export interface StoryClipPacket {
  id: string;
  project_id: string;
  episode_number: number;
  clip_number: number;
  start_time: string;
  end_time: string;
  duration_sec: number;
  packet_json: string;
  created_at: string;
}

export interface StoryConcept {
  id: string;
  project_id: string;
  raw_input: string;
  genre: string;
  tone: string;
  world_keywords: string;
  romance_level: string;
  mystery_level: string;
  action_level: string;
  ending_mood: string;
  target_audience: string;
  genre_overlay_json: string;
  approved_markdown: string;
  approved_json: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface StoryBoundaryFrame {
  id: string;
  project_id: string;
  episode_number: number;
  frame_id: string;
  timecode: string;
  description: string;
  image_prompt: string;
  raw_json: string;
  created_at: string;
}

// ── Video Provider Profiles ──────────────────────────

export type VideoProvider = 'higgsfield' | 'seedance_2_0';

export interface VideoProviderProfile {
  id: VideoProvider;
  label: string;
  minClipSec: number;
  maxClipSec: number;
  supportsFrameChain: boolean;
  supportsMultiShot: boolean;
  description: string;
}

export const VIDEO_PROVIDERS: VideoProviderProfile[] = [
  {
    id: 'higgsfield',
    label: 'Higgsfield Cinema Studio',
    minClipSec: 4,
    maxClipSec: 20,
    supportsFrameChain: true,
    supportsMultiShot: false,
    description: 'Frame-chain 기반 영상 생성. Start/End frame 쌍으로 클립을 정의.',
  },
  {
    id: 'seedance_2_0',
    label: 'Seedance 2.0',
    minClipSec: 4,
    maxClipSec: 15,
    supportsFrameChain: false,
    supportsMultiShot: true,
    description: 'Multi-shot cinematic clip 지원. 한 클립 안에서 카메라/프레이밍 전환 가능.',
  },
];

export interface ShotBeat {
  beatIndex: number;
  startSec: number;
  endSec: number;
  beatType: 'intro' | 'reveal' | 'reaction' | 'scale' | 'dialogue' | 'action' | 'transition' | 'custom';
  framing: string;
  cameraProgression: string;
  revealProgression: string;
  pacingNote: string;
  description: string;
}

export interface SeedanceClipPacket {
  clipNumber: number;
  startTime: string;
  endTime: string;
  totalDurationSec: number;
  clipMode: 'single_beat' | 'multi_shot';
  shotSequenceCount: number;
  shotSequence: ShotBeat[];
  shotProgression: string;
  cameraProgression: string;
  revealProgression: string;
  pacingProgression: string;
  sceneObjective: string;
  dialogue: string | null;
  audio: string;
  seedancePrompt: string;
}

export interface FrameVideoOutputV2 {
  provider: VideoProvider;
  header: { title: string; episodeNumber: number; duration: string };
  timeline: string;
  boundaryFrames: {
    frameId: string;
    timecode: string;
    description: string;
    imagePrompt: string;
  }[];
  higgsfieldClipPackets: {
    clipNumber: number;
    startTime: string;
    endTime: string;
    durationSec: number;
    startFrameId: string;
    endFrameId: string;
    shotType: string;
    cameraMovement: string;
    speedRamp: string;
    audio: string;
    dialogue: string | null;
    sceneObjective: string;
    videoPrompt: string;
  }[];
  seedanceClipPackets: SeedanceClipPacket[];
}

// ── Reference Lab Data Models ────────────────────────

export type ReferenceSourceType = 'text' | 'file' | 'link' | 'image' | 'video_note' | 'subtitle';
export type ReferenceTag = 'story' | 'tone' | 'character' | 'visual' | 'monster' | 'romance' | 'mystery' | 'pacing';

export interface ReferenceSource {
  id: string;
  project_id: string;
  type: ReferenceSourceType;
  title: string;
  raw_text: string;
  file_path: string;
  source_url: string;
  tags_json: string;
  user_note: string;
  created_at: string;
}

export interface ReferenceAnalysis {
  id: string;
  source_id: string;
  project_id: string;
  genre: string;
  tone: string;
  themes_json: string;
  character_types_json: string;
  relationship_dynamics_json: string;
  mystery_elements_json: string;
  visual_motifs_json: string;
  pacing_notes: string;
  romance_pattern: string;
  twist_pattern: string;
  avoid_cliches_json: string;
  raw_json: string;
  created_at: string;
}

export interface ReferenceSynthesis {
  id: string;
  project_id: string;
  selected_source_ids_json: string;
  summary_markdown: string;
  structured_json: string;
  created_at: string;
  updated_at: string;
}

export interface StoryInputBridge {
  id: string;
  project_id: string;
  reference_synthesis_id: string;
  prompt_ready_summary: string;
  structured_json: string;
  created_at: string;
}
