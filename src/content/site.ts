// Every fact and word on the site lives here, so a number or link changes in one place.
// Usage numbers come from Google Analytics, counted since each site launched (given by Aaryav, Oct 2026).

export const SITE_URL = 'https://aaryavsharma-portfolio.vercel.app';

export const profile = {
  name: 'Aaryav Sharma',
  email: 'shar0674@umn.edu',
  github: 'https://github.com/aaryavvatts-lab',
  resume: 'https://drive.google.com/file/d/1PW4Nn-z34CHWJqmoNFJ7LJkQCbAGdzI1/view?usp=sharing',
  school: 'Eastview High School',
  town: 'Apple Valley, Minnesota',
  grade: 'sophomore',
  classOf: 2029,
};

export type Link = { label: string; href: string; external?: boolean };

export type Stat = { value: string; label: string };

export type Usage = { users: number; active?: number };

export const usage = {
  neuroBook: { users: 160, active: 35 },
  rootsRivers: { users: 140, active: 20 },
  edan: { users: 120, active: 15 },
  sasaSite: { users: 20 },
} satisfies Record<string, Usage>;

export const totalUsers = Object.values(usage).reduce((sum, u) => sum + u.users, 0);

export const nav: Link[] = [
  { label: 'About', href: '/about' },
  { label: 'Built', href: '/built' },
  { label: 'Leadership & service', href: '/leadership' },
  { label: 'Contact', href: '/contact' },
];

/* ---------- Textbooks and websites ---------- */

export type Build = {
  id: string;
  name: string;
  kind: string;
  role: string;
  summary: string;
  why?: string;
  stats: Stat[];
  links: Link[];
  image: { src: string; alt: string; w: number; h: number };
};

export const textbooks: Build[] = [
  {
    id: 'roots-rivers',
    name: 'Roots & Rivers',
    kind: 'Free interactive textbook',
    role: 'I wrote and built it for SASA',
    summary:
      'An interactive guide to the cultures of South Asia for high school students. It covers eight countries in 22 chapters: ancient history, Partition, food, music, cricket, the diaspora and more. Every chapter has a simulation you can play with, like spinning a festival calendar or drawing a kolam, plus an Ask Your Elders guide for talking with your own family.',
    why: 'A lot of us grew up with these traditions and never learned the why. Its Club Kit plans 20 monthly meetings over two school years.',
    stats: [
      { value: String(usage.rootsRivers.users), label: 'readers since launch' },
      { value: '22', label: 'chapters, each with a simulation' },
      { value: '248,000', label: 'words in the whole book' },
    ],
    links: [
      { label: 'Read Roots & Rivers', href: 'https://aaryavvatts-lab.github.io/south-asian-culture-textbook/', external: true },
    ],
    image: { src: '/img/shots/roots-rivers.webp', alt: 'The Roots & Rivers home page, with its chapter list and counts of chapters, simulations and countries.', w: 1200, h: 750 },
  },
  {
    id: 'neuron-bedside',
    name: 'From Neuron to Bedside',
    kind: 'Free interactive textbook',
    role: 'I wrote and built it',
    summary:
      'A free, interactive neuroscience textbook for high school students and future doctors. Each chapter has a hands-on simulation you run in your browser and ends with a clinical case that follows a doctor’s reasoning from symptoms to the part of the nervous system that is affected. It also covers the topics high school neuroscience competitions ask about, with practice questions and a mock exam.',
    why: 'Many high schools teach little or no neuroscience. I wanted a free book that makes it easier to start.',
    stats: [
      { value: String(usage.neuroBook.users), label: 'readers since launch' },
      { value: String(usage.neuroBook.active), label: 'active readers' },
      { value: '192,000', label: 'words in the whole book' },
    ],
    links: [
      { label: 'Read the textbook', href: 'https://aaryavvatts-lab.github.io/neuroscience-textbook/', external: true },
    ],
    image: { src: '/img/shots/neuron-bedside.webp', alt: 'The From Neuron to Bedside home page.', w: 1200, h: 750 },
  },
];

export const websites: Build[] = [
  {
    id: 'edan',
    name: 'EDAN',
    kind: 'Website',
    role: 'I designed and built the website',
    summary:
      'The Epilepsy Data & Advocacy Network is a Minnesota group, founded by Rishik Kondadadi, that checks the public websites of all 329 school districts for a seizure plan a family could find. I designed and built its website: the district search, the charts, the free Seizure-Safe Schools packet page and the rest of the site.',
    stats: [
      { value: String(usage.edan.users), label: 'visitors since launch' },
      { value: '329', label: 'school districts you can look up' },
    ],
    links: [{ label: 'Visit EDAN', href: 'https://edanmn.vercel.app/', external: true }],
    image: { src: '/img/shots/edan.webp', alt: 'The EDAN home page, which says 7 in 10 Minnesota districts post no findable seizure plan.', w: 1200, h: 750 },
  },
  {
    id: 'sasa-site',
    name: 'SASA website',
    kind: 'Website',
    role: 'I designed and built it for our club',
    summary:
      'The website for Eastview’s South Asian Student Association. It has a live countdown to the next meeting, a map of South Asia, and a year of 19 festivals in order, each with a short page about it.',
    stats: [{ value: String(usage.sasaSite.users), label: 'visitors since launch' }],
    links: [{ label: 'Visit the SASA site', href: 'https://evhs-sasa.vercel.app/', external: true }],
    image: { src: '/img/shots/sasa.webp', alt: 'The SASA website home page.', w: 1200, h: 750 },
  },
];

/* ---------- Research projects ---------- */

export type Project = {
  id: string;
  name: string;
  short: string; // label used on the 3D map
  tags: string[];
  summary: string;
  why: string;
  stats: Stat[];
  source: string;
  demo: string;
  demoLabel: string;
  code?: string;
  image: { src: string; alt: string };
  status?: string;
};

export const projects: Project[] = [
  {
    id: 'slicewise',
    name: 'SliceWise',
    short: 'SliceWise',
    tags: ['MRI', 'Alzheimer’s'],
    summary:
      'A model that reads Alzheimer’s stage from one MRI slice scored 99 percent, until I noticed the same person’s scans were landing on both sides of the train and test split. Once I fixed that, most of the accuracy was gone. I also built a general checker anyone can use to find the same mistake in their own dataset.',
    why: 'A video made this look like a weekend project. It is, but the honest version has a much smaller result than the video showed, and I wanted to show exactly why.',
    stats: [
      { value: '98.9%', label: 'split by slice' },
      { value: '33.7%', label: 'split by patient' },
      { value: '0.94', label: 'AUC for dementia versus none, judged per patient' },
    ],
    source: 'OASIS, Washington University in St. Louis',
    demo: 'https://alzheimers-mri-classifier.vercel.app/',
    demoLabel: 'Open the demo',
    code: 'https://github.com/aaryavvatts-lab/neurolink-alzheimers-mri',
    image: { src: '/img/slicewise.jpg', alt: 'One MRI slice from the OASIS dataset, from a person scored at the moderate stage.' },
  },
  {
    id: 'neurospeech',
    name: 'NeuroSpeech',
    short: 'NeuroSpeech',
    tags: ['ECoG', 'Speech'],
    summary:
      'NeuroSpeech reads sentences from 256 electrodes in the speech motor cortex of a man with ALS, using data Stanford released in 2024. I also looked at what the model’s mistakes say about how the brain plans mouth movement.',
    why: 'A short video called this kind of work telepathy, which is wrong. Part of the write-up explains what this technology really is and what it is not.',
    stats: [
      { value: '17.08%', label: 'word error rate' },
      { value: '37.2%', label: 'of sentences exactly right' },
      { value: '10,948', label: 'attempted sentences in the data' },
    ],
    source: 'Card et al. 2024, NEJM, Dryad 10.5061/dryad.dncjsxm85',
    demo: 'https://als-speech-decoder.vercel.app/',
    demoLabel: 'Open the demo',
    code: 'https://github.com/aaryavvatts-lab/neurospeech',
    image: { src: '/img/neurospeech-dark.webp', alt: 'Activity across 256 channels while the participant tried to say one sentence.' },
  },
  {
    id: 'corticaltap',
    name: 'CorticalTap',
    short: 'CorticalTap',
    tags: ['ECoG', 'Movement decoding'],
    summary:
      'I pointed a next-word predictor, the kind behind text suggestions, at 735 electrodes on the brain surface of 8 epilepsy patients. It was trained to predict movement during a tapping game. Then I built tests that proved my own headline number wrong.',
    why: 'Everyone assumes a bigger, fancier model wins. I wanted to test that against the simplest possible baseline, in public.',
    stats: [
      { value: '0.879', label: 'plain logistic regression' },
      { value: '0.858', label: 'transformer' },
      { value: '8 of 8', label: 'patients where training on other patients made things worse' },
    ],
    source: 'OpenNeuro ds005931, Wayne State University, CC0',
    demo: 'https://ecog-movement-decoder.vercel.app/',
    demoLabel: 'Open the decoder',
    code: 'https://github.com/aaryavvatts-lab/corticaltap',
    image: { src: '/img/corticaltap-dark.webp', alt: '725 electrode contacts from the eight patients, drawn side on.' },
  },
  {
    id: 'octaves',
    name: 'Octaves in the Visual Cortex',
    short: 'Octaves',
    tags: ['EEG', 'Brain-computer interface'],
    summary:
      'Eight dry electrodes on the back of the head can tell which of four flickering lights someone is looking at. That is the core of an interface that lets a person who cannot speak or move pick an answer just by looking at it. The standard method looked fine until I checked what it was really answering.',
    why: 'This is the same signal real assistive spellers use for people with paralysis. I wanted to know if the textbook method everyone cites holds up on real hardware.',
    stats: [
      { value: '59%', label: 'textbook method' },
      { value: '83.9%', label: 'fixed to read the whole spectrum' },
      { value: '99.4%', label: 'live, given two seconds to settle' },
    ],
    source: 'OpenNeuro ds004745, CC0',
    demo: 'https://ssvep-bci-decoder.vercel.app/',
    demoLabel: 'Open the decoder',
    code: 'https://github.com/aaryavvatts-lab/octaves-in-the-visual-cortex',
    image: { src: '/img/octaves-dark.png', alt: 'The four flicker rates and their harmonics, weighted by the measured signal to noise ratio.' },
  },
  {
    id: 'gait',
    name: 'Reading walking speed from the scalp',
    short: 'Walking speed',
    tags: ['EEG', 'EMG'],
    summary:
      'I used EEG and leg muscle sensors from 58 people walking at three speeds to run a simulated wheelchair speed control. Brain signal alone needs about twelve seconds to settle on an answer. Add the muscle sensors and it takes three.',
    why: 'This connects to the peripheral nerve health idea I am working on. I wanted to see for myself how much a muscle sensor adds over the brain signal alone.',
    stats: [
      { value: '92.3%', label: 'random split, which means almost nothing' },
      { value: '52.8%', label: 'held-out person, brain only' },
      { value: '97.6%', label: 'brain and muscle together' },
    ],
    source: 'PhysioNet, Katmah et al. 2026, CC BY 4.0',
    demo: 'https://eeg-walking-speed.vercel.app/',
    demoLabel: 'Open the demo',
    code: 'https://github.com/aaryavvatts-lab/eeg-gait-speed',
    image: { src: '/img/gait-dark.png', alt: 'Person S44’s real treadmill speed as a step line, with the model’s guess once a second.' },
  },
  {
    id: 'myodecode',
    name: 'MyoDecode',
    short: 'MyoDecode',
    tags: ['EMG', 'Gestures'],
    summary:
      'MyoDecode reads five hand gestures from four muscle sensors on the forearm in under half a second. A method published in 1993 beats a modern neural network here. Most of the accuracy people report for this task comes from how the data is split, not from the model.',
    why: 'Muscle sensors are the other half of the nerve health idea. I wanted to know how few sensors and how little time I could get away with and still read a gesture reliably.',
    stats: [
      { value: '98.7%', label: 'leaky split' },
      { value: '93.4%', label: 'tested on a person it had never seen' },
      { value: '80.6%', label: 'still works with one sensor' },
    ],
    source: '8 subject EMG set, leakage checked against Kapoor and Narayanan, 2023',
    demo: 'https://emg-gesture-decoder.vercel.app/',
    demoLabel: 'Open the demo',
    code: 'https://github.com/aaryavvatts-lab/myodecode',
    image: { src: '/img/myodecode-dark.webp', alt: 'Four forearm muscle sensors during one hand gesture, raw signal.' },
  },
  {
    id: 'artifactscope',
    name: 'EEG Artifact Scope',
    short: 'Artifact Scope',
    tags: ['EEG', 'Data quality'],
    summary:
      'A tool that checks whether an EEG recording holds brain activity or just blinks, jaw clenches and cable movement. I calibrated it on 30 people wearing five headsets at once, each doing 20 cued blinks, so the same blink from the same person at the same moment was recorded five different ways.',
    why: 'Most people check this by eye, which stops working once you have forty recordings and a deadline. I found four separate bugs while building it, and all four are written up.',
    stats: [
      { value: '88 to 100%', label: 'of cued blinks found, depending on the headset' },
      { value: '30 of 30', label: 'people whose jaw clench scored worse than their own rest' },
      { value: '0 bytes', label: 'of your recording uploaded' },
    ],
    source: '30 subject, 5 headset open dataset, cued blink and jaw clench protocol',
    demo: 'https://eeg-artifact-finder.vercel.app/',
    demoLabel: 'Open the tool',
    code: 'https://github.com/aaryavvatts-lab/eeg-artifact-scope',
    image: { src: '/img/artifactscope-dark.png', alt: 'The average blink as four headsets recorded it, with the middle half of blinks shaded.' },
  },
  {
    id: 'neuroswitch',
    name: 'neuroswitch',
    short: 'neuroswitch',
    tags: ['fMRI', 'Nerve injury'],
    status: 'still running',
    summary:
      'Does the brain reorganize after someone loses the use of a hand to nerve damage, not brain damage? I used fMRI from 25 patients and 46 people with no injury, recorded while they drew with each hand. I built four separate tests meant to prove the result wrong before I would believe it.',
    why: 'If the brain adapts after nerve injury, that changes what a nerve health monitoring device should look for.',
    stats: [
      { value: '20 of 20', label: 'people checked so far showed the basic hand effect' },
      { value: '18 of 66', label: 'people processed, so every number will change' },
    ],
    source: 'OpenNeuro ds008162, Washington University in St. Louis, CC0',
    demo: 'https://hand-injury-brain-rewiring.vercel.app/',
    demoLabel: 'Open the study',
    code: 'https://github.com/aaryavvatts-lab/neuroswitch',
    image: { src: '/img/neuroswitch-dark.webp', alt: 'The 241 brain regions of the atlas, seen from above.' },
  },
  {
    id: 'pneumonia',
    name: 'Chest X-ray Pneumonia Detector',
    short: 'Pneumonia X-ray',
    tags: ['Chest X-rays'],
    summary:
      'A VGG16 network fine-tuned on the Kaggle chest X-ray dataset, rebuilt from a tutorial with a proper validation split, class weighting and an honest evaluation. It runs in your browser and shows a Grad-CAM map of where it looked. It is tuned to miss few pneumonia cases, so it raises a false alarm on roughly one in four normal X-rays.',
    why: 'I wanted to redo a popular tutorial with a proper validation split and report every number, including the false alarms.',
    stats: [
      { value: '89.9%', label: 'accuracy on the 624 image test set' },
      { value: '97.9%', label: 'sensitivity, pneumonia caught' },
      { value: '76.5%', label: 'specificity, normal cleared' },
    ],
    source: 'Kermany et al., via Paul Mooney on Kaggle',
    demo: 'https://pneumonia-xray-detector.vercel.app/',
    demoLabel: 'Open the detector',
    code: 'https://github.com/aaryavvatts-lab/pneumonia-detector',
    image: { src: '/img/pneumonia.jpg', alt: 'A chest X-ray from the Kaggle test set, a pneumonia case.' },
  },
  {
    id: 'diabetes',
    name: 'Diabetes Risk Predictor',
    short: 'Diabetes risk',
    tags: ['Clinical data'],
    summary:
      'A diabetes risk model trained on the Pima Indians Diabetes dataset, 768 women aged 21 and over, running entirely in your browser. The tutorial version scores 77.3% on the test rows but misses about half of the true cases. I added a logistic model with a sensitivity slider so you can see what catching more cases costs in false alarms.',
    why: 'I wanted a teaching demo that shows how a clinical prediction model behaves, with its limits on the same page as its result.',
    stats: [
      { value: '77.3%', label: 'test accuracy of the tutorial model' },
      { value: '52%', label: 'recall, so about half of true cases are missed' },
    ],
    source: 'Pima Indians Diabetes Database (NIDDK). Tutorial by Siddhardhan.',
    demo: 'https://diabetes-risk-model.vercel.app/',
    demoLabel: 'Open the predictor',
    image: { src: '/img/diabetes-dark.webp', alt: 'Glucose across and BMI up for the women in the Pima dataset. Darker dots are diagnosed cases.' },
  },
];

/* ---------- Leadership and service ---------- */

export type Role = {
  id: string;
  name: string;
  title: string;
  when: string;
  body: string[];
  stats?: Stat[];
  links?: Link[];
};

export const leadership: Role[] = [
  {
    id: 'sasa',
    name: 'South Asian Student Association (SASA)',
    title: 'Co-founder and Co-Vice President, Eastview High School',
    when: '2026 to present',
    body: [
      'Growing up, I felt scared to show my culture, and sometimes I did not want to. SASA had been quiet at Eastview for a couple of years, and this year a group of us brought it back so there would be a place where everyone could share theirs openly. You don’t have to be South Asian to join.',
      'We meet one Friday a month with food, games, and a different festival or country each time. I lead a team of 6, built the club’s website, and wrote Roots & Rivers, a free 22-chapter textbook whose Club Kit plans 20 monthly meetings.',
    ],
    stats: [
      { value: '26', label: 'members' },
      { value: '6', label: 'people on the team I lead' },
      { value: String(usage.rootsRivers.users), label: 'readers of Roots & Rivers' },
    ],
    links: [
      { label: 'Read Roots & Rivers', href: 'https://aaryavvatts-lab.github.io/south-asian-culture-textbook/', external: true },
      { label: 'SASA website', href: 'https://evhs-sasa.vercel.app/', external: true },
    ],
  },
  {
    id: 'neurogidas',
    name: 'NeuroGIDAS',
    title: 'Founder and Co-President, Eastview High School',
    when: 'December 2025 to present',
    body: [
      'I started NeuroGIDAS to make neuroscience easier for any student to get into. It is our school’s chapter of GIDAS (Genes in Diseases and Symptoms), a miRcore program where students use real genetic data to study how diseases work.',
      'I wrote the proposal that got us a faculty advisor, and I came up with a statewide Brain Cancer Innovation pitch competition that the club is now working to run.',
    ],
    stats: [
      { value: '15+', label: 'members' },
      { value: '5', label: 'people on the team I lead' },
    ],
  },
  {
    id: 'flowstate',
    name: 'Flow State Framework',
    title: 'Co-lead, Outreach Committee',
    when: 'July 2026 to present',
    body: [
      'Flow State Framework is a Minnesota debate tutoring organization that offers free coaching and tutoring to middle and high school students. I co-lead its 4-person Outreach Committee. We have grown active membership by 18 students and built partnerships with 3 local schools and community organizations.',
    ],
    stats: [
      { value: '+18', label: 'active members' },
      { value: '3', label: 'school and community partners' },
    ],
  },
];

export const service: { name: string; body: string }[] = [
  { name: 'SOS Children’s Satsang', body: 'Volunteer mentor since January 2025, teaching ethical values through mindfulness and community programs. More than 80 hours.' },
  { name: 'Feed My Starving Children', body: 'Volunteer meal packing for hunger relief.' },
  { name: 'HOSA', body: 'Medical Innovation, the Healthcare Issues exam, and Health Literacy Ambassador.' },
  { name: 'DECA', body: 'Entrepreneurship Team Decision Making and the Entrepreneurship Innovation Plan.' },
  { name: 'Debate', body: 'Analytical reasoning, policy analysis and public speaking.' },
  { name: 'Tennis', body: 'Junior varsity tennis at Eastview.' },
];

export const volunteerHours = '260+';
export const volunteerNote = 'All together, I have logged more than 260 volunteer hours, including my work in the Weber Lab.';

/* ---------- About ---------- */

export type Experience = { when: string; title: string; place: string; body: string; image?: { src: string; alt: string; credit: string } };

export const research: Experience[] = [
  {
    when: 'July to September 2026',
    title: 'Lab assistant',
    place: 'Moriarty/Weber Lab, University of Minnesota Twin Cities',
    body: 'I worked under Dr. Richa Kaushal in a gene editing and cell therapy lab that sits under the Crane Lab. My day-to-day covered iPSC culture, turning iPSCs into macrophages, media prep, gene editing, passaging cells and running maxipreps. Before I started, I made my own study guide on iPSCs, iPSC-derived macrophages, flow cytometry and cell surface markers, and I kept a running log of my shifts.',
    image: { src: '/img/macrophages.webp', alt: 'Cultured macrophages under a microscope.', credit: 'Macrophages, the cell type I helped differentiate. Picture by Buchacher and colleagues, CC BY 4.0, via Wikimedia Commons. Not from the lab I worked in.' },
  },
  {
    when: 'September 2025 to present',
    title: 'Neurosurgery mentorship',
    place: 'Dr. Anant Naik, University of Minnesota',
    body: 'I have watched two live neurosurgeries with Dr. Naik and seen each full procedure from inside the operating room. Through this mentorship I started looking into caregiver burden and communication gaps in glioblastoma (GBM) treatment, which became NeuroBridge GBM.',
  },
  {
    when: 'May 2026 to present',
    title: 'NeuroBridge GBM',
    place: 'HOSA Medical Innovation project',
    body: 'I am building a plan for caregiver communication and symptom tracking in glioblastoma care. So far I have cold-emailed more than 150 neuroscience and medical professionals for interviews and clinical feedback, and I have run surveys and calls to learn what caregivers really struggle with.',
    image: { src: '/img/glioblastoma-mri.webp', alt: 'A glioblastoma on MRI before and after surgery.', credit: 'Picture by Ars Neurochirurgica, CC BY 4.0, via Wikimedia Commons.' },
  },
  {
    when: 'September to December 2025',
    title: 'ThinkNeuro research cohort',
    place: 'Computational neuroscience',
    body: 'I studied computational neuroscience, including EEG classification and machine learning, and read hundreds of papers on EEG activity and brain function. I presented a research poster to a panel of judges.',
  },
];

export const academics: { label: string; value: string }[] = [
  { label: 'School', value: 'Eastview High School, Apple Valley, MN. Class of 2029.' },
  { label: 'Courses', value: 'AP Biology, Chemistry, Physics C, Psychology, Statistics and Computer Science A.' },
  { label: 'UMTYMP', value: 'University of Minnesota Talented Youth Mathematics Program since September 2023. I have finished Algebra 1 and 2, Geometry, Pre-Calculus and Calculus I, and I am continuing through Calculus II and III.' },
  { label: 'AMC', value: 'AMC 8 (2025): 21 out of 25, top 5% nationally. AMC 10 (2025): top 25% nationally.' },
  { label: 'Interests', value: 'Neurosurgery, neuro-oncology, computational neuroscience and neurotechnology.' },
];

export const skills = ['Python', 'R', 'Java', 'Excel', 'Google Workspace', 'Data analysis', 'Website development', 'AI automation', 'Literature review', 'Survey design', 'Poster design', 'Professional outreach'];

/* ---------- Contact ---------- */

export const lookingFor: { title: string; body: string }[] = [
  { title: 'Research positions', body: 'A neuroscience, neural engineering or brain-computer interface lab where I can help with data analysis, reading papers or building pipelines. In person in the Twin Cities is easiest, but I can do computer work remotely, and I already have a working setup for EEG, ECoG, fMRI and MRI data.' },
  { title: 'Neurotech internships', body: 'An internship or summer role at a company that works on brain-computer interfaces, EMG or EEG wearables, or neural monitoring devices. I am building my own idea in this area, and I want to learn from a team that has already shipped something.' },
  { title: 'Mentorship', body: 'A grad student, postdoc or founder who will look at my work and tell me what I am getting wrong. I would rather hear it now than after I have built more on top of it.' },
  { title: 'Collaboration and competitions', body: 'Co-writing a paper, entering a science fair or research competition together, or teaming up on a hackathon.' },
];

/* ---------- Home ---------- */

// Measured from the books' source files on 2026-10-23.
export type Book = {
  id: string; name: string; url: string; cover: string; subject: string;
  words: string; chapters: number; sims: number; quiz: number; glossary: number; refs: number;
  readers: number; active: number;
};

export const books: Book[] = [
  {
    id: 'roots-rivers', name: 'Roots & Rivers', url: 'https://aaryavvatts-lab.github.io/south-asian-culture-textbook/',
    cover: '/img/covers/roots-rivers.webp', subject: 'The cultures of all eight South Asian countries',
    words: '248,000', chapters: 22, sims: 22, quiz: 220, glossary: 368, refs: 220,
    readers: usage.rootsRivers.users, active: usage.rootsRivers.active,
  },
  {
    id: 'neuron-bedside', name: 'From Neuron to Bedside', url: 'https://aaryavvatts-lab.github.io/neuroscience-textbook/',
    cover: '/img/covers/neuron-bedside.webp', subject: 'Neuroscience for high school students and future doctors',
    words: '192,000', chapters: 16, sims: 16, quiz: 160, glossary: 253, refs: 160,
    readers: usage.neuroBook.users, active: usage.neuroBook.active,
  },
];

export const home = {
  lede: 'I’m a sophomore at Eastview High School in Apple Valley, Minnesota. I wrote two free textbooks, about 440,000 words in all, with 300 users so far. I helped start two clubs, SASA with 26 members and NeuroGIDAS with more than 15, and I redid the analysis on ten public brain and medical datasets.',
  books: {
    title: 'Two free textbooks',
    why: 'Many high schools teach little or no neuroscience. A lot of South Asian students, me included, grew up with traditions nobody explained.',
    did: 'So I wrote a free textbook for each. Every chapter has a simulation you can run, a quiz and sourced references, and neither book needs an account or shows ads.',
    result: 'Google Analytics counts 300 users since they launched: 160 for From Neuron to Bedside and 140 for Roots & Rivers.',
  },
  sasa: {
    title: 'South Asian Student Association',
    role: 'Co-founder and Co-Vice President',
    why: 'Growing up, I felt scared to show my culture. SASA had been quiet at Eastview for a couple of years.',
    did: 'This year a group of us brought it back. I lead a team of 6, built the club’s website, and wrote Roots & Rivers, whose Club Kit plans 20 monthly meetings over two school years.',
    result: 'The club has 26 members. Each meeting covers one festival or country, with food and games, and anyone can join.',
    stats: [
      { value: '26', label: 'members' },
      { value: '6', label: 'people on the team I lead' },
      { value: '19', label: 'festival pages on the club’s website' },
    ],
    links: [
      { label: 'Club website', href: 'https://evhs-sasa.vercel.app/', external: true },
      { label: 'Leadership & service', href: '/leadership#sasa' },
    ] as Link[],
  },
  gidas: {
    title: 'NeuroGIDAS',
    role: 'Founder and Co-President',
    why: 'Eastview had no club where students could get into neuroscience and genetics.',
    did: 'I wrote the proposal that got us a faculty advisor and started our chapter of GIDAS, a miRcore program where students use real genetic data to study how diseases work. I also came up with a statewide Brain Cancer Innovation pitch competition that the club is now working to run.',
    result: 'More than 15 students come to meetings, and I lead a team of 5.',
    stats: [
      { value: '15+', label: 'members' },
      { value: '5', label: 'people on the team I lead' },
    ],
    links: [{ label: 'Leadership & service', href: '/leadership#neurogidas' }] as Link[],
  },
  research: {
    title: 'Ten research projects',
    why: 'A video showed an Alzheimer’s MRI model scoring 99 percent. When I rebuilt it, scans from the same people were in both the training and the test set.',
    did: 'So for every project I take a public dataset, redo the analysis myself, and test the model on people it never saw in training. Each one has a live demo, and nine have their code online.',
    result: 'In three, the number dropped once the test was fair. SliceWise fell from 98.9% to 33.7%. In two it went up: plain logistic regression beat a transformer in CorticalTap, and reading the whole spectrum beat the textbook method in Octaves.',
  },
  edan: {
    title: 'A website for EDAN',
    role: 'Designed and built the website',
    why: 'The Epilepsy Data & Advocacy Network, founded by Rishik Kondadadi, checked every Minnesota school district for a seizure plan a family could find.',
    did: 'I designed and built EDAN’s website: 115 pages, including one for each of Minnesota’s 87 counties.',
    result: 'Google Analytics shows 120 visitors since it launched.',
    mapHelp: 'Click or pick a county to open its page on EDAN’s site. Each one shows how many of its school districts post a seizure plan, about how many residents have epilepsy, how far it is to the nearest child neurologist, ambulance times, and the county’s lawmakers.',
  },
  close: {
    title: 'So far',
    stats: [
      { value: '440,000', label: 'words in two free textbooks' },
      { value: '300', label: 'textbook users since launch, by Google Analytics' },
      { value: '2', label: 'school clubs I helped start' },
      { value: '260+', label: 'volunteer hours' },
    ] as Stat[],
    note: 'I’m looking for research positions, neurotech internships and mentors who will tell me what I’m getting wrong.',
  },
};

// Two numbers from each project's write-up: the main result, and what it should be read next to.
export const checks: { id: string; before: string; beforeLabel: string; after: string; afterLabel: string }[] = [
  { id: 'slicewise', after: '33.7%', afterLabel: 'split by patient', before: '98.9%', beforeLabel: 'the same model, split by slice' },
  { id: 'gait', after: '52.8%', afterLabel: 'new person, brain only', before: '92.3%', beforeLabel: 'random split' },
  { id: 'myodecode', after: '93.4%', afterLabel: 'person it never saw', before: '98.7%', beforeLabel: 'leaky split' },
  { id: 'octaves', after: '83.9%', afterLabel: 'reading the whole spectrum', before: '59%', beforeLabel: 'textbook method' },
  { id: 'corticaltap', after: '0.879', afterLabel: 'plain logistic regression', before: '0.858', beforeLabel: 'transformer' },
  { id: 'neurospeech', after: '17.08%', afterLabel: 'word error rate', before: '10,948', beforeLabel: 'attempted sentences in the data' },
  { id: 'artifactscope', after: '88 to 100%', afterLabel: 'of cued blinks found', before: '4', beforeLabel: 'bugs found and written up' },
  { id: 'neuroswitch', after: '20 of 20', afterLabel: 'showed the basic hand effect', before: '18 of 66', beforeLabel: 'people processed so far' },
  { id: 'pneumonia', after: '97.9%', afterLabel: 'pneumonia caught', before: '76.5%', beforeLabel: 'normal X-rays cleared' },
  { id: 'diabetes', after: '52%', afterLabel: 'of true cases caught', before: '77.3%', beforeLabel: 'accuracy' },
];
