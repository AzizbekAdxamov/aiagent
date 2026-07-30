import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.universityDirection.deleteMany();
  await prisma.educationTypeLanguage.deleteMany();
  await prisma.gallery.deleteMany();
  await prisma.news.deleteMany();
  await prisma.universityGrant.deleteMany();
  await prisma.direction.deleteMany();
  await prisma.university.deleteMany();

  // ===== UNIVERSITIES =====
  const pdp = await prisma.university.create({
    data: {
      slug: "pdp-university",
      fullNameUz: "PDP University",
      fullNameEn: "PDP University",
      abbrNameUz: "PDP",
      abbrNameEn: "PDP",
      descriptionUz: "PDP University — zamonaviy ta'lim muassasasi. IT, biznes va dizayn yo'nalishlarida bakalavr va magistratura dasturlarini taklif etadi.",
      descriptionEn: "PDP University is a modern educational institution offering bachelor and master programs in IT, business, and design.",
      institutionCategoryId: 4,
      institutionType: "university",
      locationId: 14,
      phone: "+998712345678",
      email: "info@pdp.uz",
      website: "https://pdp.uz",
      foundedYear: 2019,
      studentsCount: 5000,
      minimalTuitionFee: 35000000,
      maximalTuitionFee: 50000000,
      addressUz: "Toshkent shahri, Chilonzor tumani",
      addressEn: "Tashkent city, Chilanzar district",
      latitude: 41.2995,
      longitude: 69.2401,
      admissionPhone: "+998712345679",
      hasAccommodation: true,
      hasGrant: true,
      isPartner: true,
      isOpenForAdmission: true,
      instagramUsername: "pdp_university",
      telegramUsername: "pdp_university",
    },
  });

  const inha = await prisma.university.create({
    data: {
      slug: "inha-university",
      fullNameUz: "Inha University Toshkent",
      fullNameEn: "Inha University Tashkent",
      abbrNameUz: "INHA",
      abbrNameEn: "INHA",
      descriptionUz: "Inha University Toshkent — Janubiy Koreyaning Inha Universiteti filiali. IT va injiniring yo'nalishlari bo'yicha yuqori sifatli ta'lim beradi.",
      descriptionEn: "Inha University Tashkent is a branch of South Korea's Inha University, providing high-quality education in IT and engineering.",
      institutionCategoryId: 4,
      institutionType: "university",
      locationId: 14,
      phone: "+998712000101",
      email: "info@inha.uz",
      website: "https://inha.uz",
      foundedYear: 2014,
      studentsCount: 3000,
      minimalTuitionFee: 42000000,
      maximalTuitionFee: 55000000,
      addressUz: "Toshkent shahri, Mirzo Ulug'bek tumani",
      addressEn: "Tashkent city, Mirzo Ulugbek district",
      latitude: 41.3389,
      longitude: 69.3345,
      admissionPhone: "+998712000102",
      hasAccommodation: true,
      hasGrant: true,
      isPartner: true,
      isOpenForAdmission: true,
      instagramUsername: "inha_tashkent",
    },
  });

  const westminster = await prisma.university.create({
    data: {
      slug: "westminster-university",
      fullNameUz: "Westminster International University Toshkent",
      fullNameEn: "Westminster International University Tashkent",
      abbrNameUz: "WIUT",
      abbrNameEn: "WIUT",
      descriptionUz: "Westminster International University — Buyuk Britaniya universitetining O'zbekistondagi filiali. Biznes, iqtisod va huquq yo'nalishlari bo'yicha ta'lim beradi.",
      descriptionEn: "Westminster International University is a UK university branch in Uzbekistan offering programs in business, economics, and law.",
      institutionCategoryId: 4,
      institutionType: "university",
      locationId: 14,
      phone: "+998712381818",
      email: "info@wiut.uz",
      website: "https://wiut.uz",
      foundedYear: 2002,
      studentsCount: 4500,
      minimalTuitionFee: 38000000,
      maximalTuitionFee: 52000000,
      addressUz: "Toshkent shahri, Yunusobod tumani",
      addressEn: "Tashkent city, Yunusabad district",
      latitude: 41.3589,
      longitude: 69.2867,
      admissionPhone: "+998712381819",
      hasAccommodation: false,
      hasGrant: true,
      isPartner: true,
      isOpenForAdmission: true,
      instagramUsername: "wiut.uz",
    },
  });

  const tatu = await prisma.university.create({
    data: {
      slug: "tatu-university",
      fullNameUz: "Toshkent Axborot Texnologiyalari Universiteti",
      fullNameEn: "Tashkent University of Information Technologies",
      abbrNameUz: "TATU",
      abbrNameEn: "TUIT",
      descriptionUz: "TATU — O'zbekistondagi eng yirik IT universiteti. Axborot texnologiyalari, telekommunikatsiya va dasturiy ta'minot yo'nalishlarida mutaxassislar tayyorlaydi.",
      descriptionEn: "TUIT is the largest IT university in Uzbekistan, training specialists in information technology, telecommunications, and software engineering.",
      institutionCategoryId: 4,
      institutionType: "university",
      locationId: 14,
      phone: "+998712387200",
      email: "info@tuit.uz",
      website: "https://tuit.uz",
      foundedYear: 1955,
      studentsCount: 15000,
      minimalTuitionFee: 12000000,
      maximalTuitionFee: 22000000,
      addressUz: "Toshkent shahri, Amir Temur ko'chasi",
      addressEn: "Tashkent city, Amir Temur street",
      latitude: 41.3133,
      longitude: 69.2583,
      admissionPhone: "+998712387201",
      hasAccommodation: true,
      hasGrant: true,
      isPartner: false,
      isOpenForAdmission: true,
    },
  });

  const samdu = await prisma.university.create({
    data: {
      slug: "samarkand-state-university",
      fullNameUz: "Samarqand Davlat Universiteti",
      fullNameEn: "Samarkand State University",
      abbrNameUz: "SamDU",
      abbrNameEn: "SamSU",
      descriptionUz: "Samarqand Davlat Universiteti — O'zbekistondagi eng qadimgi universitetlardan biri. Tabiiy va gumanitar fanlar bo'yicha ta'lim beradi.",
      descriptionEn: "Samarkand State University is one of the oldest universities in Uzbekistan, offering education in natural and humanitarian sciences.",
      institutionCategoryId: 4,
      institutionType: "university",
      locationId: 8,
      phone: "+998662393100",
      email: "info@samdu.uz",
      website: "https://samdu.uz",
      foundedYear: 1927,
      studentsCount: 20000,
      minimalTuitionFee: 8000000,
      maximalTuitionFee: 15000000,
      addressUz: "Samarqand shahri, Universitet xiyoboni",
      addressEn: "Samarkand city, University avenue",
      latitude: 39.6542,
      longitude: 66.9758,
      admissionPhone: "+998662393101",
      hasAccommodation: true,
      hasGrant: true,
      isPartner: false,
      isOpenForAdmission: true,
    },
  });

  const andijon = await prisma.university.create({
    data: {
      slug: "andijan-state-university",
      fullNameUz: "Andijon Davlat Universiteti",
      fullNameEn: "Andijan State University",
      abbrNameUz: "ADU",
      abbrNameEn: "ASU",
      descriptionUz: "Andijon Davlat Universiteti — Farg'ona vodiysidagi eng yirik ta'lim muassasalaridan biri.",
      descriptionEn: "Andijan State University is one of the largest educational institutions in the Fergana Valley.",
      institutionCategoryId: 4,
      institutionType: "university",
      locationId: 2,
      phone: "+998742232200",
      email: "info@adu.uz",
      website: "https://adu.uz",
      foundedYear: 1939,
      studentsCount: 12000,
      minimalTuitionFee: 7500000,
      maximalTuitionFee: 14000000,
      addressUz: "Andijon shahri, Universitet ko'chasi",
      addressEn: "Andijan city, University street",
      hasAccommodation: true,
      hasGrant: true,
      isPartner: false,
      isOpenForAdmission: true,
    },
  });

  // ===== DIRECTIONS =====
  const se = await prisma.direction.create({
    data: {
      universityId: pdp.id,
      slug: "software-engineering",
      idNumber: "SE101",
      nameUz: "Dasturiy injiniring",
      nameEn: "Software Engineering",
      descriptionUz: "Dasturiy ta'minot ishlab chiqish, web va mobile dasturlash bo'yicha zamonaviy bilimlar",
      descriptionEn: "Modern knowledge in software development, web and mobile programming",
      categoryId: 1,
      degreeIds: [1, 2],
      contractTypeIds: [1, 2],
      hasStipend: true,
      isOpenForAdmission: true,
      isStudyTransferable: true,
      requirementUz: "IELTS 6.0 yoki SAT 1100",
      requirementEn: "IELTS 6.0 or SAT 1100",
      hasMandatorySubjects: true,
      firstSubject: "Matematika",
      secondSubject: "Ingliz tili",
    },
  });

  await prisma.educationTypeLanguage.create({
    data: {
      directionId: se.id,
      academicYear: 2026,
      educationTypeId: 1,
      educationLanguageId: 2,
      localTuitionFee: 35000000,
      internationalTuitionFee: 50000000,
    },
  });

  await prisma.educationTypeLanguage.create({
    data: {
      directionId: se.id,
      academicYear: 2026,
      educationTypeId: 1,
      educationLanguageId: 1,
      localTuitionFee: 25000000,
    },
  });

  const ai = await prisma.direction.create({
    data: {
      universityId: pdp.id,
      slug: "artificial-intelligence",
      idNumber: "AI501",
      nameUz: "Sun'iy intellekt",
      nameEn: "Artificial Intelligence",
      descriptionUz: "Machine learning, deep learning, neyron tarmoqlar va AI texnologiyalari",
      descriptionEn: "Machine learning, deep learning, neural networks and AI technologies",
      categoryId: 1,
      degreeIds: [1, 2],
      contractTypeIds: [1, 2],
      hasStipend: true,
      isOpenForAdmission: true,
      isStudyTransferable: true,
      requirementUz: "IELTS 6.5 yoki SAT 1200",
      requirementEn: "IELTS 6.5 or SAT 1200",
      hasMandatorySubjects: true,
      firstSubject: "Matematika",
      secondSubject: "Fizika",
    },
  });

  await prisma.educationTypeLanguage.create({
    data: {
      directionId: ai.id,
      academicYear: 2026,
      educationTypeId: 1,
      educationLanguageId: 2,
      localTuitionFee: 40000000,
      internationalTuitionFee: 55000000,
    },
  });

  const cs = await prisma.direction.create({
    data: {
      universityId: inha.id,
      slug: "computer-science",
      idNumber: "CS201",
      nameUz: "Kompyuter fanlari",
      nameEn: "Computer Science",
      descriptionUz: "Kompyuter fanlari, algoritmlar va dasturlash asoslari",
      descriptionEn: "Computer science, algorithms and programming fundamentals",
      categoryId: 1,
      degreeIds: [1],
      contractTypeIds: [1],
      hasStipend: true,
      isOpenForAdmission: true,
      isStudyTransferable: true,
      requirementUz: "IELTS 6.0",
      requirementEn: "IELTS 6.0",
      hasMandatorySubjects: true,
      firstSubject: "Matematika",
      secondSubject: "Ingliz tili",
    },
  });

  await prisma.educationTypeLanguage.create({
    data: {
      directionId: cs.id,
      academicYear: 2026,
      educationTypeId: 1,
      educationLanguageId: 2,
      localTuitionFee: 42000000,
      internationalTuitionFee: 55000000,
    },
  });

  const it = await prisma.direction.create({
    data: {
      universityId: tatu.id,
      slug: "information-technology",
      idNumber: "IT301",
      nameUz: "Axborot texnologiyalari",
      nameEn: "Information Technology",
      descriptionUz: "Axborot texnologiyalari, tarmoq va telekommunikatsiya",
      descriptionEn: "Information technology, networking and telecommunications",
      categoryId: 1,
      degreeIds: [1, 2],
      contractTypeIds: [1],
      hasStipend: true,
      isOpenForAdmission: true,
      isStudyTransferable: true,
      hasMandatorySubjects: true,
      firstSubject: "Matematika",
      secondSubject: "Fizika",
    },
  });

  await prisma.educationTypeLanguage.create({
    data: {
      directionId: it.id,
      academicYear: 2026,
      educationTypeId: 1,
      educationLanguageId: 1,
      localTuitionFee: 12000000,
    },
  });

  await prisma.educationTypeLanguage.create({
    data: {
      directionId: it.id,
      academicYear: 2026,
      educationTypeId: 1,
      educationLanguageId: 2,
      localTuitionFee: 18000000,
    },
  });

  const ba = await prisma.direction.create({
    data: {
      universityId: westminster.id,
      slug: "business-administration",
      idNumber: "BA401",
      nameUz: "Biznes boshqaruvi",
      nameEn: "Business Administration",
      descriptionUz: "Biznes boshqaruvi, marketing va menejment",
      descriptionEn: "Business administration, marketing and management",
      categoryId: 2,
      degreeIds: [1, 2],
      contractTypeIds: [1, 2],
      hasStipend: true,
      isOpenForAdmission: true,
      isStudyTransferable: true,
      requirementUz: "IELTS 6.0",
      requirementEn: "IELTS 6.0",
      hasMandatorySubjects: true,
      firstSubject: "Ingliz tili",
      secondSubject: "Matematika",
    },
  });

  await prisma.educationTypeLanguage.create({
    data: {
      directionId: ba.id,
      academicYear: 2026,
      educationTypeId: 1,
      educationLanguageId: 2,
      localTuitionFee: 38000000,
      internationalTuitionFee: 52000000,
    },
  });

  const biology = await prisma.direction.create({
    data: {
      universityId: samdu.id,
      slug: "biology",
      nameUz: "Biologiya",
      nameEn: "Biology",
      descriptionUz: "Biologiya fanlari, ekologiya va biotexnologiya",
      descriptionEn: "Biological sciences, ecology and biotechnology",
      categoryId: 3,
      degreeIds: [1, 2, 3],
      contractTypeIds: [1],
      hasStipend: true,
      isOpenForAdmission: true,
      isStudyTransferable: false,
      hasMandatorySubjects: true,
      firstSubject: "Biologiya",
      secondSubject: "Kimyo",
    },
  });

  await prisma.educationTypeLanguage.create({
    data: {
      directionId: biology.id,
      academicYear: 2026,
      educationTypeId: 1,
      educationLanguageId: 1,
      localTuitionFee: 8000000,
    },
  });

  // ===== GRANTS =====
  await prisma.universityGrant.create({
    data: {
      grantImage: "https://images.unsplash.com/photo-1523050854058-8df90110c6f1?w=400",
      universitySlugName: "pdp-university",
      universityNameUz: "PDP University",
      universityNameEn: "PDP University",
      regionNameUz: "Toshkent shahri",
      regionNameEn: "Tashkent City",
      grantTitleUz: "100% Grant — IT yo'nalishi",
      grantTitleEn: "100% Scholarship — IT Program",
      grantDescUz: "PDP University IT yo'nalishlari uchun 100% grant ajratadi. Talablar: IELTS 6.5, SAT 1300, intervyu, esse, GPA 4.5. Grant 4 yil davomida amal qiladi.",
      grantDescEn: "PDP University offers 100% scholarship for IT programs. Requirements: IELTS 6.5, SAT 1300, interview, essay, GPA 4.5. Scholarship is valid for 4 years.",
      status: "active",
      order: 1,
      universityId: pdp.id,
    },
  });

  await prisma.universityGrant.create({
    data: {
      grantImage: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400",
      universitySlugName: "inha-university",
      universityNameUz: "Inha University Toshkent",
      universityNameEn: "Inha University Tashkent",
      regionNameUz: "Toshkent shahri",
      regionNameEn: "Tashkent City",
      grantTitleUz: "IELTS Grant — 50% chegirma",
      grantTitleEn: "IELTS Scholarship — 50% discount",
      grantDescUz: "Inha University IELTS 6.5 va undan yuqori ballga ega bo'lgan talabalarga 50% grant beradi. Qo'shimcha talablar: suhbat va test.",
      grantDescEn: "Inha University offers 50% scholarship for students with IELTS 6.5 or higher. Additional requirements: interview and test.",
      status: "active",
      order: 2,
      universityId: inha.id,
    },
  });

  await prisma.universityGrant.create({
    data: {
      grantImage: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400",
      universitySlugName: "westminster-university",
      universityNameUz: "Westminster International University Toshkent",
      universityNameEn: "Westminster International University Tashkent",
      regionNameUz: "Toshkent shahri",
      regionNameEn: "Tashkent City",
      grantTitleUz: "Academic Excellence Grant",
      grantTitleEn: "Academic Excellence Grant",
      grantDescUz: "WIUT akademik ko'rsatkichlari yuqori bo'lgan talabalarga 25% dan 75% gacha grant taqdim etadi. Tanlov asosida beriladi.",
      grantDescEn: "WIUT offers 25% to 75% scholarships for students with high academic performance. Awarded on a competitive basis.",
      status: "active",
      order: 3,
      universityId: westminster.id,
    },
  });

  await prisma.universityGrant.create({
    data: {
      grantImage: "https://images.unsplash.com/photo-1532619187608-e5375cab36aa?w=400",
      universitySlugName: "pdp-university",
      universityNameUz: "PDP University",
      universityNameEn: "PDP University",
      regionNameUz: "Toshkent shahri",
      regionNameEn: "Tashkent City",
      grantTitleUz: "SAT Grant — 50% gacha",
      grantTitleEn: "SAT Scholarship — up to 50%",
      grantDescUz: "SAT 1200+ ball to'plagan abituriyentlarga 50% gacha grant. Matematika va ingliz tili fanlaridan yuqori ball talab qilinadi.",
      grantDescEn: "Up to 50% scholarship for applicants with SAT 1200+. High scores in math and English required.",
      status: "active",
      order: 4,
      universityId: pdp.id,
    },
  });

  // ===== NEWS =====
  await prisma.news.create({
    data: {
      relatedTo: "university",
      relationId: pdp.id,
      universityId: pdp.id,
      headerImage: "https://images.unsplash.com/photo-1562774053-701939374585?w=400",
      titleUz: "PDP University 2026-yil uchun qabulni boshladi",
      titleEn: "PDP University started admission for 2026",
      descriptionUz: "PDP University 2026-2027 o'quv yili uchun qabul jarayonini boshladi. Barcha yo'nalishlar bo'yicha hujjatlar qabul qilinmoqda. Grantlar soni oshirildi.",
      descriptionEn: "PDP University has started the admission process for the 2026-2027 academic year. Documents are being accepted for all programs. The number of grants has been increased.",
      status: "active",
      viewsCount: 1250,
      tagIds: [1, 2],
    },
  });

  await prisma.news.create({
    data: {
      relatedTo: "grant",
      relationId: 1,
      headerImage: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400",
      titleUz: "Yangi grant dasturi: IT mutaxassislari uchun 100% stipendiya",
      titleEn: "New grant program: 100% scholarship for IT professionals",
      descriptionUz: "O'zbekistonda IT sohasida tahsil olayotgan talabalar uchun yangi 100% grant dasturi ishga tushdi. Dastur 4 yil davomida o'qish va yashash xarajatlarini qoplaydi.",
      descriptionEn: "A new 100% scholarship program has been launched for students studying IT in Uzbekistan. The program covers tuition and living expenses for 4 years.",
      status: "active",
      viewsCount: 2300,
      tagIds: [1, 3],
    },
  });

  await prisma.news.create({
    data: {
      relatedTo: "event",
      headerImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400",
      titleUz: "2026-yilgi Ta'lim Forumi: O'zbekistonda oliy ta'lim istiqbollari",
      titleEn: "2026 Education Forum: Prospects of higher education in Uzbekistan",
      descriptionUz: "Toshkentda bo'lib o'tadigan Ta'lim Forumida O'zbekiston oliy ta'lim muassasalari, xalqaro universitetlar va grant dasturlari ishtirok etadi.",
      descriptionEn: "The Education Forum in Tashkent will feature higher education institutions, international universities, and grant programs.",
      status: "active",
      viewsCount: 3450,
      tagIds: [2, 4],
    },
  });

  await prisma.news.create({
    data: {
      relatedTo: "university",
      relationId: inha.id,
      universityId: inha.id,
      headerImage: "https://images.unsplash.com/photo-1523050854058-8df90110c6f1?w=400",
      titleUz: "INHA Universiteti yangi laboratoriya ochdi",
      titleEn: "INHA University opened a new laboratory",
      descriptionUz: "Inha University Toshkent zamonaviy AI va robototexnika laboratoriyasini ishga tushirdi. Laboratoriya eng so'nggi texnologiyalar bilan jihozlangan.",
      descriptionEn: "Inha University Tashkent has launched a modern AI and robotics laboratory equipped with the latest technologies.",
      status: "active",
      viewsCount: 890,
      tagIds: [1, 3, 5],
    },
  });

  await prisma.news.create({
    data: {
      relatedTo: "university",
      relationId: tatu.id,
      universityId: tatu.id,
      headerImage: "https://images.unsplash.com/photo-1562774053-701939374585?w=400",
      titleUz: "TATU xalqaro reytingda yuqori o'rinni egalladi",
      titleEn: "TUIT ranks high in international rankings",
      descriptionUz: "Toshkent Axborot Texnologiyalari Universiteti xalqaro reytingda O'zbekiston IT universitetlari orasida eng yuqori o'rinni egalladi.",
      descriptionEn: "Tashkent University of Information Technologies has achieved the highest ranking among Uzbek IT universities in international rankings.",
      status: "active",
      viewsCount: 1560,
      tagIds: [1, 5],
    },
  });

  // ===== GALLERY =====
  await prisma.gallery.create({
    data: {
      universityId: pdp.id,
      imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=800",
      captionUz: "PDP University binosi",
      order: 1,
    },
  });

  await prisma.gallery.create({
    data: {
      universityId: pdp.id,
      imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c6f1?w=800",
      captionUz: "Talabalar hayoti",
      order: 2,
    },
  });

  await prisma.gallery.create({
    data: {
      universityId: inha.id,
      imageUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800",
      captionUz: "Inha University kampus",
      order: 1,
    },
  });

  console.log("✅ Seeding completed!");
  console.log("📊 Created:", {
    universities: 6,
    directions: 6,
    educationTypeLanguages: 9,
    grants: 4,
    news: 5,
    galleries: 3,
  });
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
