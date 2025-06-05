
        const crypto = require('crypto');
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        function hashPassword(password) {
          const hash = crypto.createHash('md5');
          hash.update(password);
          return hash.digest('hex');
        }
        
        async function readUserFile(filename) {
          const content = await fs.readFile(`./users/${filename}`);
          return content;
        }
        
        async function runCommand(cmd) {
          const result = await execAsync(`node ${cmd}`);
          return result.stdout;
        }
      