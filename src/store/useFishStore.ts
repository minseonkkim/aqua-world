import { create } from 'zustand';
import { FishSpecies } from '../types';

interface FishStoreState {
  allSpecies: FishSpecies[];
  setAllSpecies: (species: FishSpecies[]) => void;
  getSpeciesById: (id: string) => FishSpecies | undefined;
}

// MVP 10종 fish species 데이터
const MVP_FISH_SPECIES: FishSpecies[] = [
  {
    id: 'clownfish',
    name: '클라운피시',
    scientificName: 'Amphiprioninae',
    rarity: 'common',
    habitat: '열대 산호초',
    description: '흰 줄무늬가 특징인 산호초의 인기 어종. 말미잘과 공생 관계를 맺는다.',
    modelPath: 'models/fish/clownfish.glb',
    thumbnailPath: 'images/fish/clownfish.png',
    baseGrowthTime: 300,
  },
  {
    id: 'guppy',
    name: '구피',
    scientificName: 'Poecilia reticulata',
    rarity: 'common',
    habitat: '담수',
    description: '화려한 지느러미를 가진 소형 열대어. 번식력이 강하고 키우기 쉽다.',
    modelPath: 'models/fish/guppy.glb',
    thumbnailPath: 'images/fish/guppy.png',
    baseGrowthTime: 240,
  },
  {
    id: 'goldfish',
    name: '금붕어',
    scientificName: 'Carassius auratus',
    rarity: 'common',
    habitat: '담수',
    description: '관상어의 대명사. 다양한 색상과 형태가 있으며 수명이 길다.',
    modelPath: 'models/fish/goldfish.glb',
    thumbnailPath: 'images/fish/goldfish.png',
    baseGrowthTime: 360,
  },
  {
    id: 'seahorse',
    name: '해마',
    scientificName: 'Hippocampus',
    rarity: 'common',
    habitat: '열대 해역',
    description: '수직으로 헤엄치는 독특한 어류. 수컷이 새끼를 낳는 것으로 유명하다.',
    modelPath: 'models/fish/seahorse.glb',
    thumbnailPath: 'images/fish/seahorse.png',
    baseGrowthTime: 420,
  },
  {
    id: 'zebrafish',
    name: '제브라피시',
    scientificName: 'Danio rerio',
    rarity: 'common',
    habitat: '담수',
    description: '줄무늬 패턴이 아름다운 소형 어류. 과학 연구에도 널리 사용된다.',
    modelPath: 'models/fish/zebrafish.glb',
    thumbnailPath: 'images/fish/zebrafish.png',
    baseGrowthTime: 200,
  },
  {
    id: 'betta',
    name: '베타',
    scientificName: 'Betta splendens',
    rarity: 'rare',
    habitat: '담수',
    description: '화려한 지느러미와 공격적인 성격으로 유명한 싸움꼬리. 아름다운 색상이 특징.',
    modelPath: 'models/fish/betta.glb',
    thumbnailPath: 'images/fish/betta.png',
    baseGrowthTime: 600,
  },
  {
    id: 'angelfish',
    name: '엔젤피시',
    scientificName: 'Pterophyllum scalare',
    rarity: 'rare',
    habitat: '아마존',
    description: '삼각형의 독특한 체형을 가진 우아한 어류. 아마존 강이 원산지.',
    modelPath: 'models/fish/angelfish.glb',
    thumbnailPath: 'images/fish/angelfish.png',
    baseGrowthTime: 720,
  },
  {
    id: 'mandarin_fish',
    name: '만다린피시',
    scientificName: 'Synchiropus splendidus',
    rarity: 'rare',
    habitat: '산호초',
    description: '세계에서 가장 아름다운 물고기 중 하나. 화려한 색상의 패턴이 특징.',
    modelPath: 'models/fish/mandarin.glb',
    thumbnailPath: 'images/fish/mandarin.png',
    baseGrowthTime: 900,
  },
  {
    id: 'leafy_sea_dragon',
    name: '바다용',
    scientificName: 'Phycodurus eques',
    rarity: 'epic',
    habitat: '온대 해역',
    description: '잎사귀처럼 생긴 위장 돌기가 있는 신비로운 어류. 해마의 친척.',
    modelPath: 'models/fish/sea_dragon.glb',
    thumbnailPath: 'images/fish/sea_dragon.png',
    baseGrowthTime: 1800,
  },
  {
    id: 'coelacanth',
    name: '실러캔스',
    scientificName: 'Latimeria chalumnae',
    rarity: 'legendary',
    habitat: '심해',
    description: '3억 6천만 년 전부터 살아온 살아있는 화석. 현존하는 가장 신비로운 물고기.',
    modelPath: 'models/fish/coelacanth.glb',
    thumbnailPath: 'images/fish/coelacanth.png',
    baseGrowthTime: 7200,
  },
];

export const useFishStore = create<FishStoreState>((set, get) => ({
  allSpecies: MVP_FISH_SPECIES,

  setAllSpecies: species => set({ allSpecies: species }),

  getSpeciesById: id => get().allSpecies.find(s => s.id === id),
}));
