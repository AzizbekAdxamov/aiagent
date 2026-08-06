const { intentClassifier } = await import('../src/ai-agent/intent-classifier.ts');
const tests = [
  "men IT ga qiziman lekin matemakim yaxshi emas ingiliz tilim b2 toshkent sharida yashayman",
  "IT yoqadi lekin matematikam yaxshi emas",
  "Ingliz tilim B2, Toshkentda yashayman, IT ga qiziqaman",
];
for (const t of tests) {
  const r = intentClassifier.classify(t);
  console.log(JSON.stringify({ q: t.substring(0, 40), intent: r.intent, entities: r.entities }));
}
