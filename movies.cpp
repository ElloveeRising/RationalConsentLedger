//Steven Schell
//06/24/25
//Exam 1
//Rational Consent Ledger

# include <iostream>
# include <string>
# include <vector>
# include <ctime> //for time stamps
using namespace std;

// this structure represents one entry in the RCL
struct RCLEntry {
	int entryNumber; // unique entry number
	string timestamp; // time of entry
	string userPrompt; // prompt given by user
	string modelReply; // model's reply to user prompt
	string category; // Decision type (e.g. Refusal, Consent, etc.)
};

// main function start
int main () {
	vector<RCLEntry> ledgerEntries; // dynamic list of all RCL entries
	int entryNumber = 1; // counts each new RCL entry
	int totalPrompts = 0; // total number of user prompts
	string userInput; // to hold user input

	cout << "What can I help you with?" << endl;

	// main loop: keep asking for user input until they type "quit"
	while (true) {
		cout << "\nEnter your prompt (or type 'quit' to exit): ";
		getline(cin, userInput);

		if (userInput == "quit") {
			break;
		}
		totalPrompts++;

		//for now, echo input to prove the loop works. Insert API call and RCL logic here later
		cout << "You entered: " << userInput << endl;
		
	}

	// For now, display summary stats after loop ends
	cout << "\nTotal user prompts: " << totalPrompts << endl;
	cout << "Total Rcl entries: " << ledgerEntries.size() << endl;
	// add the percent calculation after RCL logic is built

	cout << "\nThank you for using the Rational Consent Ledger Prototype. Goodbye!" << endl;

	return 0;
	}