import { seedDemoData } from '../src/lib/seedDemo';

async function run() {
  console.log('🌱 Seeding TechForm Buddy with demo citizen data...');
  try {
    const res = await seedDemoData();
    console.log(`\n🎉 ${res.message}`);
    console.log(`Backup created at: ${res.backupPath}`);
    console.log('----------------------------------------------------');
    console.log('Demo Account:    demo@techformbuddy.in');
    console.log('Demo Password:   DemoUser@2026');
    console.log('Citizen Name:    Aarav Sharma');
    console.log('Tracking ID 1:   TFB-GOV-849201 (Electricity)');
    console.log('Tracking ID 2:   TFB-EDU-981240 (Scholarship)');
    console.log('App Number 1:    PSK-DEL-2026-9041 (Passport)');
    console.log('App Number 2:    NSP-2026-88123 (Scholarship)');
    console.log('----------------------------------------------------\n');
  } catch (err) {
    console.error('Error seeding demo data:', err);
    process.exit(1);
  }
}

run();
