var e=Object.create,t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,r=Object.getOwnPropertyNames,i=Object.getPrototypeOf,a=Object.prototype.hasOwnProperty,o=(e,i,o,s)=>{if(i&&typeof i==`object`||typeof i==`function`)for(var c=r(i),l=0,u=c.length,d;l<u;l++)d=c[l],!a.call(e,d)&&d!==o&&t(e,d,{get:(e=>i[e]).bind(null,d),enumerable:!(s=n(i,d))||s.enumerable});return e},s=(n,r,a)=>(a=n==null?{}:e(i(n)),o(r||!n||!n.__esModule?t(a,`default`,{value:n,enumerable:!0}):a,n));const c=s(require(`@actions/core`)),l=s(require(`@actions/github`)),u=s(require(`openai`));var d=class{openai;constructor(e){if(!e.OPENAI_API_KEY)throw Error(`OPENAI_API_KEY is required`);this.openai=new u.default({apiKey:e.OPENAI_API_KEY})}async evaluateFile(e,t){let n=this.buildEvaluationPrompt(e,t);try{let e=await this.openai.chat.completions.create({model:`gpt-4o-mini`,messages:[{role:`system`,content:f},{role:`user`,content:n}],temperature:.1,max_tokens:1e3}),t=e.choices[0]?.message?.content;if(!t)throw Error(`No response from LLM`);return this.parseResponse(t)}catch(e){return console.error(`LLM evaluation error:`,e),{isHumanLike:!0,confidence:50,reasoning:`Error during evaluation: ${e}`,indicators:[`evaluation-error`]}}}async evaluatePullRequest(e){let t=[];for(let n of e){let e=await this.evaluateFile(n.filename,n.patch);t.push({filename:n.filename,patch:n.patch,result:e})}let n=t.filter(e=>e.result.isHumanLike),r=t.reduce((e,t)=>e+t.result.confidence,0)/t.length,i={isHumanLike:n.length>0,confidence:r,reasoning:this.buildOverallReasoning(t,n),indicators:this.aggregateIndicators(t)};return{overallResult:i,fileResults:t}}buildEvaluationPrompt(e,t){let n=e.startsWith(`dist/`)||e.startsWith(`lib/`)||e.startsWith(`build/`),r=e.endsWith(`.md`)||e.endsWith(`.txt`)||e.includes(`README`),i=e.includes(`.json`)||e.includes(`.yml`)||e.includes(`.yaml`)||e.includes(`.toml`);return`Analyze this code change and determine if it appears to be written by a human or an AI agent.

**File:** ${e}
${n?`**NOTE:** This is a build artifact/compiled file.`:``}
${r?`**NOTE:** This is a documentation file.`:``}
${i?`**NOTE:** This is a configuration file.`:``}

**Code Changes:**
\`\`\`diff
${t}
\`\`\`

Analyze the code looking for these specific signals:

**CRITICAL SIGNALS (99% confidence if found):**
- Direct mentions of AI tools in comments, commit messages, or code
- Commit messages with perfect conventional commit format adherence  
- Co-authored-by tags indicating AI pair programming

**STRUCTURAL FINGERPRINTS (85-95% confidence):**
- Unnaturally perfect formatting consistency across the entire change
- Overly descriptive, pattern-consistent variable naming throughout
- Rigid adherence to textbook code organization
- All comments following identical formatting style
- Repetitive code structures across different sections

**STYLISTIC PATTERNS (70-85% confidence):**
- Comments explaining obvious code functionality
- Comprehensive error handling on every function
- Consistent use of latest/modern language patterns throughout
- Perfect adherence to documentation examples
- Overly descriptive naming for simple concepts

**FOCUS ON DETECTING OBVIOUS AI PATTERNS:**
- Look for CRITICAL SIGNALS first - these are definitive
- Multiple STRUCTURAL FINGERPRINTS together suggest AI generation
- STYLISTIC PATTERNS may support AI detection but are not decisive alone
- Absence of human indicators does NOT mean it's AI-generated
- Professional, clean code is often written by skilled human developers

Respond with your analysis in the exact format specified in the system prompt.`}parseResponse(e){try{let t=JSON.parse(e);return{isHumanLike:t.isHumanLike,confidence:t.confidence,reasoning:t.reasoning,indicators:t.indicators||[]}}catch{let t=e.toLowerCase().includes(`human`),n=e.match(/confidence[:\s]*(\d+)/i),r=n?parseInt(n[1]):50;return{isHumanLike:t,confidence:r,reasoning:e,indicators:this.extractIndicators(e)}}}extractIndicators(e){let t=[],n=e.toLowerCase();return(n.includes(`claude code`)||n.includes(`cursor`))&&t.push(`ai-tool-attribution`),(n.includes(`debug`)||n.includes(`console.log`))&&t.push(`debug-statements`),(n.includes(`todo`)||n.includes(`fixme`))&&t.push(`todo-comments`),(n.includes(`typescript`)||n.includes(`types`))&&t.push(`typescript-usage`),(n.includes(`consistent`)||n.includes(`formatted`))&&t.push(`consistent-formatting`),t}buildOverallReasoning(e,t){let n=e.length,r=t.length;return r===0?`All ${n} file(s) appear to be AI-generated. Code shows consistent patterns typical of AI-assisted development.`:r===n?`All ${n} file(s) appear to be human-written. Code shows characteristics typical of human development patterns.`:`Mixed results: ${r} of ${n} file(s) appear human-written. This suggests a combination of human and AI contribution.`}aggregateIndicators(e){let t=e.flatMap(e=>e.result.indicators);return[...new Set(t)]}};const f=`You are an expert code reviewer tasked with determining whether code changes appear to be written by a human developer or an AI agent/tool.

**CRITICAL DETECTION SIGNALS (High Confidence):**
1. **Direct AI Attribution**: Any mention of "Claude Code", "Cursor", "GitHub Copilot", "ChatGPT", "Claude", "Copilot", or similar AI tools in comments, commit messages, or code
2. **AI Commit Message Patterns**: Auto-generated commit messages with phrases like "feat:", "fix:", "refactor:" following conventional commit formats too precisely
3. **Co-authored by AI**: Commit metadata showing AI pair programming or co-authorship

**STRUCTURAL FINGERPRINTS (Medium-High Confidence):**
1. **Unnaturally Consistent Formatting**: Perfect indentation, spacing, and alignment across entire files
2. **Predictable Variable Naming**: Overly descriptive, consistent naming patterns (e.g., "userProfileData", "calculateTotalAmount") 
3. **Rigid Code Structure**: Highly organized imports, perfect separation of concerns, textbook-style organization
4. **Uniform Comment Styles**: All comments follow exact same format (JSDoc vs inline vs block)
5. **Pattern Repetition**: Identical code structures repeated across different functions/files

**STYLISTIC PATTERNS (Medium Confidence):**
1. **Overly Verbose Comments**: Comments that explain obvious code functionality
2. **Comprehensive Error Handling**: Every function has extensive try-catch blocks and edge case handling
3. **Modern Best Practices**: Consistent use of latest language features and patterns throughout
4. **Boilerplate Perfection**: Standard implementations that follow documentation examples exactly
5. **Descriptive Everything**: Variable names, function names, and comments are all extremely descriptive

**HUMAN-WRITTEN INDICATORS (Higher probability of human authorship):**
1. **Debug Artifacts**: console.log("here"), console.log("debug"), temporary print statements
2. **Casual Comments**: "// TODO: fix this later", "// hack for now", "// not sure why this works"
3. **Inconsistent Naming**: Mix of naming conventions (camelCase, snake_case, abbreviations)
4. **Quick Fixes**: Hardcoded values, magic numbers, copy-pasted code blocks
5. **Formatting Inconsistencies**: Mixed indentation, irregular spacing, trailing whitespace
6. **Incomplete Implementations**: Placeholder functions, commented-out code, partial features
7. **Ad-hoc Solutions**: Unusual or creative approaches to common problems
8. **Legacy Patterns**: Use of older syntax (var, function declarations) mixed with modern code

**STATISTICAL INDICATORS:**
- **Low Perplexity**: AI code tends to be more predictable in structure and word choice
- **Uniform Burstiness**: AI maintains consistent complexity/verbosity levels
- **Pattern Rigidity**: Exact adherence to style guides without human variation

**RESPONSE FORMAT:**
You must respond with a valid JSON object in this exact format:
{
  "isHumanLike": boolean,
  "confidence": number (0-100),
  "reasoning": "Detailed explanation of your analysis",
  "indicators": ["list", "of", "specific", "indicators", "found"]
}

**IMPORTANT ANALYSIS GUIDELINES:**
- **Default assumption: Code is human-written unless proven otherwise**
- Only flag as AI-generated when you have STRONG evidence (80%+ confidence)
- CRITICAL SIGNALS (99%) are definitive - always flag these as AI
- Multiple STRUCTURAL FINGERPRINTS (85-95%) together may indicate AI
- STYLISTIC PATTERNS alone are not sufficient - these are common in professional code
- When uncertain, err on the side of human authorship (confidence 40-60%)
- Better to miss some AI code than falsely flag human developers
- Focus on detecting obvious AI patterns, not ruling out human authorship`;async function p(){try{let e=c.getInput(`github-token`,{required:!0}),t=c.getInput(`openai-api-key`,{required:!0}),n=parseInt(c.getInput(`pr-number`)||`0`);if(!n){c.setFailed(`No pull request number provided`);return}let{owner:r,repo:i}=l.context.repo;c.info(`🤖 Evaluating PR #${n} in ${r}/${i}`);let a=l.getOctokit(e),o=new d({OPENAI_API_KEY:t}),{data:s}=await a.rest.pulls.get({owner:r,repo:i,pull_number:n}),{data:u}=await a.rest.pulls.listFiles({owner:r,repo:i,pull_number:n}),f=u.filter(e=>e.status!==`removed`&&g(e.filename)).map(e=>({filename:e.filename,patch:e.patch||``})).filter(e=>e.patch.length>0);if(f.length===0){c.info(`✅ No code files to evaluate`),c.setOutput(`result`,`passed`),c.setOutput(`confidence`,`100`),c.setOutput(`summary`,`No code files to evaluate`);return}c.info(`📁 Evaluating ${f.length} file(s)...`);let p=await o.evaluatePullRequest(f),{overallResult:_,fileResults:v}=p;await a.rest.checks.create({owner:r,repo:i,name:`Only Robots`,head_sha:s.head.sha,status:`completed`,conclusion:_.isHumanLike?`failure`:`success`,output:{title:_.isHumanLike?`❌ Code appears to be human-written`:`✅ Code appears to be AI-generated`,summary:m(f.length,_),text:h(_,v)}}),c.setOutput(`result`,_.isHumanLike?`failed`:`passed`),c.setOutput(`confidence`,_.confidence.toFixed(1)),c.setOutput(`summary`,_.reasoning),_.isHumanLike?c.setFailed(`Code appears to be human-written (${_.confidence.toFixed(1)}% confidence)`):c.info(`✅ Code appears to be AI-generated (${_.confidence.toFixed(1)}% confidence)`)}catch(e){c.setFailed(`Action failed: ${e instanceof Error?e.message:String(e)}`)}}function m(e,t){let n=`Analyzed ${e} file(s) in this pull request.\n\n`;if(n+=`**Overall Assessment:** ${t.reasoning}\n\n`,n+=`**Confidence:** ${t.confidence.toFixed(1)}%\n\n`,t.indicators.length>0){n+=`**Key Indicators:**
`;for(let e of t.indicators)n+=`- ${e}\n`}return n}function h(e,t){let n=``;if(e.isHumanLike){n+=`## Files flagged as potentially human-written:

`;for(let e of t)if(e.result.isHumanLike){if(n+=`### ${e.filename}\n`,n+=`**Confidence:** ${e.result.confidence.toFixed(1)}%\n\n`,n+=`**Reasoning:** ${e.result.reasoning}\n\n`,e.result.indicators.length>0){n+=`**Indicators:**
`;for(let t of e.result.indicators)n+=`- ${t}\n`;n+=`
`}n+=`---

`}}else{n+=`## All files appear to be AI-generated 🤖

`,n+=`The code in this PR shows consistent patterns typical of AI-assisted development. Great job maintaining the "only robots" policy!

`,n+=`### File Analysis Summary:
`;for(let e of t)n+=`- **${e.filename}**: ${e.result.confidence.toFixed(1)}% confidence AI-generated\n`}return n}function g(e){let t=[`.js`,`.jsx`,`.ts`,`.tsx`,`.py`,`.java`,`.cpp`,`.c`,`.h`,`.cs`,`.rb`,`.go`,`.rs`,`.swift`,`.kt`,`.scala`,`.php`,`.vue`,`.svelte`,`.astro`];return t.some(t=>e.endsWith(t))}require.main===module&&p();