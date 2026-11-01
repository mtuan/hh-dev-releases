import type { FakePlayerGender, FakePlayerName } from './types';

interface LocalizedName { latin: string; native?: string; }
interface Culture { country: string; familyFirst?: boolean; male: LocalizedName[]; female: LocalizedName[]; family: LocalizedName[]; }

const names = (...values: string[]): LocalizedName[] => values.map((latin) => ({ latin }));
const localized = (...values: Array<[string, string]>): LocalizedName[] => values.map(([latin, native]) => ({ latin, native }));

const CULTURES: Culture[] = [
    { country: 'Vietnam', familyFirst: true, male: names('Anh Tuấn', 'Minh Quân', 'Đức Anh', 'Hoàng Nam'), female: names('Mai Anh', 'Thu Hà', 'Ngọc Lan', 'Phương Linh'), family: names('Nguyễn', 'Trần', 'Lê', 'Phạm', 'Vũ') },
    { country: 'Japan', familyFirst: true, male: localized(['Haruto', '陽翔'], ['Ren', '蓮'], ['Sota', '颯太'], ['Yuto', '悠斗']), female: localized(['Yui', '結衣'], ['Aoi', '葵'], ['Hina', '陽菜'], ['Sakura', '桜']), family: localized(['Sato', '佐藤'], ['Suzuki', '鈴木'], ['Takahashi', '高橋'], ['Tanaka', '田中'], ['Watanabe', '渡辺']) },
    { country: 'China', familyFirst: true, male: localized(['Wei', '伟'], ['Jun', '军'], ['Hao', '浩'], ['Ming', '明']), female: localized(['Mei', '美'], ['Xinyi', '欣怡'], ['Lili', '丽丽'], ['Jing', '静']), family: localized(['Wang', '王'], ['Li', '李'], ['Zhang', '张'], ['Liu', '刘'], ['Chen', '陈']) },
    { country: 'South Korea', familyFirst: true, male: localized(['Min-jun', '민준'], ['Seo-jun', '서준'], ['Ji-ho', '지호'], ['Hyun-woo', '현우']), female: localized(['Seo-yeon', '서연'], ['Ji-woo', '지우'], ['Ha-eun', '하은'], ['Soo-min', '수민']), family: localized(['Kim', '김'], ['Lee', '이'], ['Park', '박'], ['Choi', '최'], ['Jung', '정']) },
    { country: 'United States', male: names('James', 'Michael', 'Daniel', 'George'), female: names('Emma', 'Olivia', 'Sophia', 'Emily'), family: names('Smith', 'Johnson', 'Brown', 'Jones', 'Davis') },
    { country: 'France', male: names('Louis', 'Gabriel', 'Hugo', 'Arthur'), female: names('Emma', 'Louise', 'Chloé', 'Camille'), family: names('Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert') },
    { country: 'Spain', male: names('Hugo', 'Mateo', 'Lucas', 'Daniel'), female: names('Lucía', 'Sofía', 'Martina', 'Paula'), family: names('García', 'Fernández', 'González', 'Rodríguez', 'López') },
    { country: 'Brazil', male: names('Miguel', 'Arthur', 'Heitor', 'Davi'), female: names('Helena', 'Alice', 'Laura', 'Manuela'), family: names('Silva', 'Santos', 'Oliveira', 'Souza', 'Lima') },
    { country: 'Thailand', male: localized(['Anan', 'อนันต์'], ['Kiet', 'เกียรติ'], ['Niran', 'นิรันดร์'], ['Somchai', 'สมชาย']), female: localized(['Mali', 'มาลี'], ['Suda', 'สุดา'], ['Pim', 'พิม'], ['Kanya', 'กัญญา']), family: localized(['Saelim', 'แซ่ลิ้ม'], ['Srisai', 'ศรีใส'], ['Boonmee', 'บุญมี'], ['Thongchai', 'ธงชัย'], ['Intarawong', 'อินทรวงศ์']) },
    { country: 'Indonesia', male: names('Arif', 'Bima', 'Dimas', 'Rizky'), female: names('Ayu', 'Citra', 'Dewi', 'Putri'), family: names('Santoso', 'Wijaya', 'Saputra', 'Hidayat', 'Pratama') },
];

const plain = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').replace(/đ/g, 'd');

function aliases(name: string, familyFirst: boolean, nativeName?: string): string[] {
    const ascii = plain(name);
    const parts = ascii.split(/[\s-]+/);
    return [...new Set([
        nativeName,
        ascii,
        parts.map((part) => part[0]).join('').toUpperCase(),
        `${parts[0][0]}. ${parts.at(-1)}`,
        familyFirst ? parts.slice(1).concat(parts[0]).join(' ') : `${parts.at(-1)} ${parts[0]}`,
    ].filter((value): value is string => Boolean(value && value !== name)))];
}

export function seededFakePlayers(): FakePlayerName[] {
    const result: FakePlayerName[] = [];
    for (const culture of CULTURES) {
        for (const gender of ['male', 'female'] as FakePlayerGender[]) {
            culture[gender].forEach((given, givenIndex) => culture.family.forEach((family, familyIndex) => {
                const name = culture.familyFirst ? `${family.latin} ${given.latin}` : `${given.latin} ${family.latin}`;
                const nativeName = family.native && given.native
                    ? culture.familyFirst ? `${family.native}${given.native}` : `${given.native} ${family.native}`
                    : undefined;
                result.push({
                    id: `seed-${culture.country.toLowerCase().replace(/\s/g, '-')}-${gender}-${givenIndex}-${familyIndex}`,
                    name,
                    age: 18 + ((givenIndex * 7 + familyIndex * 3) % 28),
                    gender,
                    country: culture.country,
                    aliases: aliases(name, Boolean(culture.familyFirst), nativeName),
                });
            }));
        }
    }
    return result;
}
