const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('console.error(') &&
       (lines[i].includes('listener error') || lines[i].includes('snapshot error') || lines[i].includes('onSnapshot error') || lines[i].includes('Failed to subscribe'))) {
        
        let indent = lines[i].match(/^\s*/)[0];
        if (lines[i-1] && lines[i-1].includes('resource-exhausted')) continue;
        
        let newContent = `${indent}if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
${indent}  document.dispatchEvent(new CustomEvent('quota-exceeded'));
${indent}} else {
${lines[i]}
${indent}}`;
        lines[i] = newContent;
        modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Updated ${filePath}`);
  }
}

const files = [
  './src/store/useShiftStore.ts',
  './src/store/useUsersStore.ts',
  './src/store/useReportStore.ts',
  './src/store/useAnnouncementStore.ts',
  './src/store/useNotificationStore.ts',
  './src/store/useLeavePlanStore.ts',
  './src/store/useStoreMetricsStore.ts',
  './src/pages/ProjectsView.tsx',
  './src/pages/CalendarView.tsx',
  './src/pages/MainBoard.tsx',
  './src/pages/KeyPassManagement.tsx'
];

files.forEach(fixFile);
