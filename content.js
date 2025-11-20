console.log("GitHub PR Branch Info extension loaded");

// Function to process PR rows
async function processPRRows() {
    const rows = document.querySelectorAll('.js-issue-row');

    for (const row of rows) {
        if (row.dataset.branchInfoInjected) continue;

        // Mark as processed immediately to avoid double processing
        row.dataset.branchInfoInjected = 'true';

        const linkElement = row.querySelector('a.js-navigation-open');
        if (!linkElement) continue;

        const prUrl = linkElement.href;

        try {
            // Fetch the PR page
            const response = await fetch(prUrl);
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Extract branch info
            // Based on inspection:
            // Base: <span class="...">main</span> inside <a href="/facebook/react/tree/main">
            // Head: <span class="...">fix-using-syntax-preservation</span> inside <a href="/shivas1432/react/tree/fix-using-syntax-preservation">
            // Both are usually in the header meta section.

            const treeLinks = Array.from(doc.querySelectorAll('a[href*="/tree/"]'));

            // Filter for links that likely represent branches in the header (usually have title "user:branch")
            const branchLinks = treeLinks.filter(link => link.title && link.title.includes(':'));

            if (branchLinks.length >= 2) {
                // Usually the first is base, second is head in the "wants to merge X into Y from Z" sentence
                // For forks, the link contains "user:branch", so we want the last span which is the branch name.
                // Example: <a><span>user</span>:<span>branch</span></a>

                const getBranchName = (link) => {
                    const spans = link.querySelectorAll('span');
                    if (spans.length > 0) {
                        return spans[spans.length - 1].textContent.trim();
                    }
                    return link.textContent.trim();
                };

                const baseBranch = getBranchName(branchLinks[0]);
                const headBranch = getBranchName(branchLinks[1]);

                injectBranchInfo(row, baseBranch, headBranch);
            } else {
                console.log(`Could not find branch info for ${prUrl}`);
            }

        } catch (error) {
            console.error(`Error fetching PR info for ${prUrl}:`, error);
        }
    }
}

function injectBranchInfo(row, base, head) {
    const container = document.createElement('div');
    container.className = 'gh-qol-branch-info';

    const baseSpan = document.createElement('span');
    baseSpan.className = 'gh-qol-branch-base';
    baseSpan.textContent = base;

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'gh-qol-arrow';
    arrowSpan.textContent = ' ← ';

    const headSpan = document.createElement('span');
    headSpan.className = 'gh-qol-branch-head';
    headSpan.textContent = head;

    container.appendChild(baseSpan);
    container.appendChild(arrowSpan);
    container.appendChild(headSpan);

    // Find a good place to insert. 
    // Usually the row has a title and meta info. We can append to the right side or below the title.
    // We'll append to the container that holds the title link to ensure visibility.
    // We use a very specific selector to avoid picking up hidden mobile links.
    const linkElement = row.querySelector('a.js-navigation-open.markdown-title');
    if (linkElement && linkElement.parentElement) {
        linkElement.parentElement.appendChild(container);
    } else {
        console.log('Could not find visible title link for injection');
    }
}

// Initial run
processPRRows();

// Observe for page updates (Turbo/Pjax)
const observer = new MutationObserver((mutations) => {
    // Simple debounce or check if relevant nodes added
    processPRRows();
});

observer.observe(document.body, { childList: true, subtree: true });
