import { Agent, Chat, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';
import readline from 'readline';

let inputCounter = 0;

/**
 * This function runs a chat session using a chat object.
 * a chat object is obtained from an Agent.
 * @param chat
 */
export function runChat(chat: Chat, agent?: Agent) {
    // Create readline interface for user input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('You: '),
    });

    console.log(chalk.green(`\n🚀 ${chat.agentData.name} is ready!`));
    console.log(chalk.gray('Type your question below to talk to the agent.'));
    console.log(chalk.gray('Type "exit" or "quit" to end the conversation.\n'));

    // Set up readline event handlers
    rl.on('line', (input) => handleUserInput(input, rl, chat, agent));

    rl.on('close', () => {
        console.log(chalk.gray('Chat session ended.'));
        process.exit(0);
    });

    // Start the interactive chat
    rl.prompt();
}

// Function to handle user input and chat response
function isDeleteIntent(text: string) {
    const t = text.toLowerCase();
    return (
        t.includes('delete all') ||
        (t.includes('delete') && (t.includes('pdf') || t.includes('book') || t.includes('books'))) ||
        t.trim() === 'purge' ||
        t.includes('clear database') ||
        t.includes('purge database')
    );
}

async function handleUserInput(input: string, rl: readline.Interface, chat: Chat, agent?: Agent) {
    if (input.toLowerCase().trim() === 'exit' || input.toLowerCase().trim() === 'quit') {
        console.log(chalk.green('👋 Goodbye!'));
        rl.close();
        return;
    }

    if (input.trim() === '') {
        rl.prompt();
        return;
    }

    try {
        console.log(chalk.gray('Assistant is thinking...'));

        // If it's a delete intent, call the purge skill ONCE directly and short-circuit
        if (agent && isDeleteIntent(input)) {
            try {
                console.log(chalk.yellow('[Direct Skill] purge_books'));
                const result = await agent.call('purge_books', { params: input });
                console.log(chalk.green(`🤖 Assistant: ${result}`));
                rl.prompt();
                return;
            } catch (e: any) {
                console.error(chalk.red('❌ Error (purge_books):', e?.message || e));
                rl.prompt();
                return;
            }
        }

        // Send message to the agent and get response (normal flow)
        const streamChat = await chat.prompt(input).stream();

        // Clear the current line and move to a new line for the response
        process.stdout.write('\r');
        let first = true;

        streamChat.on(TLLMEvent.Content, (content) => {
            if (first) {
                content = chalk.green('🤖 Assistant: ') + content;
                first = false;
            }
            // Write content without interfering with readline
            process.stdout.write(chalk.white(content));
        });

        streamChat.on(TLLMEvent.End, () => {
            console.log('\n');
            // Restore the prompt after streaming is complete
            rl.prompt();
        });

        streamChat.on(TLLMEvent.Error, (error) => {
            console.error(chalk.red('❌ Error:', error));
            rl.prompt();
        });

        streamChat.on(TLLMEvent.ToolCall, (toolCall) => {
            console.log(
                chalk.yellow('[Calling Tool]'),
                toolCall?.tool?.name,
                chalk.gray(typeof toolCall?.tool?.arguments === 'object' ? JSON.stringify(toolCall?.tool?.arguments) : toolCall?.tool?.arguments)
            );
        });
    } catch (error) {
        console.error(chalk.red('❌ Error:', error));
        rl.prompt();
    }
}
