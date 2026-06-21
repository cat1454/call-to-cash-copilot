import fs from 'node:fs';
import readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('C:\\Users\\PHU\\.gemini\\antigravity-ide\\brain\\3f4e7acb-8eb1-48a5-b3e1-37b038b59b55\\.system_generated\\logs\\transcript.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('capture_browser_console_logs')) {
      const obj = JSON.parse(line);
      console.log("Found line:", obj.type, obj.status);
      if (obj.tool_calls) {
        console.log("Tool call arguments:", JSON.stringify(obj.tool_calls));
      }
      if (obj.content) {
        console.log("Content:", obj.content.substring(0, 1000));
      }
    }
    // Also print if this is the output of a tool call
    if (line.includes('CORTEX_STEP_TYPE_CAPTURE_BROWSER_CONSOLE_LOGS') || line.includes('capture_browser_console_logs')) {
      try {
        const obj = JSON.parse(line);
        if (obj.output) {
          console.log("OUTPUT:", JSON.stringify(obj.output).substring(0, 2000));
        }
      } catch (e) {}
    }
  }
}

main().catch(console.error);
