**short TL;DR** 👇

### **🧠 How generative engines get info**

They use:

1.  **Training data** --- giant web crawls (Common Crawl, Wikipedia,
    > Reddit links, books).

2.  **Live retrieval** --- real-time web content (news, blogs, Reddit,
    > etc.) via search APIs.

### **🌍 Source mix (training level)**

-   Common Crawl / general web: **60--80%\
    > **

-   Reddit / forums: **10--20%\
    > **

-   Books & academic text: **10--15%\
    > **

-   Wikipedia / curated data: **3--5%** (upsampled)

A major source is **Common Crawl**, which is a publicly available
archive of web crawls. Many LLM builders use Common Crawl as part of
their text base. [[Search Engine Land+3FAccT Conference+3Mozilla
Foundation+3\
]{.underline}](https://facctconference.org/static/papers24/facct24-148.pdf?utm_source=chatgpt.com)

But raw web crawl data is noisy --- that's why many models filter,
clean, dedupe, and combine with higher-quality corpora (Wikipedia, news,
books, academic articles, etc.).

In earlier models from OpenAI, datasets like *WebText* (derived from web
pages linked on Reddit) were used to help drive more readable,
conversational content. [[OpenWebText2+2FRANKI T+2\
]{.underline}](https://openwebtext2.readthedocs.io/en/latest/background/?utm_source=chatgpt.com)

There are also open, curated large text datasets like *The Pile* (which
incorporate multiple sources) used in research settings.

  ---------------------------------------------------------------------------
  **Model /        **Likely % from     **Likely % from    **Likely % from
  System**         Forums / Community  Mainstream Web     Curated /
                   (e.g. Reddit /      (blogs, news,      High-Authority
                   Q&A)**              websites)**        (Wikipedia,
                                                          academic)**
  ---------------- ------------------- ------------------ -------------------
  ChatGPT (with    5% -- 25% (higher   40% -- 70%         10% -- 40%
  retrieval / web  for conversational                     
  tool)            / niche topics)                        

  Perplexity       10% -- 40%          40% -- 70%         10% -- 30%

  Google / AI      1% -- 10%           60% -- 85%         10% -- 40%
  Overviews                                               

  Claude           \~5% -- 20%         50% -- 80%         10% -- 30%
  (web-connected                                          
  mode)                                                   
  ---------------------------------------------------------------------------

OpenAI reportedly has a bot called **GPTBot** that crawls web content
for training, and a separate indexing bot (sometimes called
OAI-SearchBot) for surfacing content in ChatGPT's answer flows.

[[https://franetic.com/how-generative-engines-assess-and-rank-reliable-content/?utm_source=chatgpt.com]{.underline}](https://franetic.com/how-generative-engines-assess-and-rank-reliable-content/?utm_source=chatgpt.com)

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Source Type**     **Why it\'s useful / common**                                                                                                            **Risks / challenges / downsides**
  ------------------- ---------------------------------------------------------------------------------------------------------------------------------------- ----------------------------------------------------------------------------------------------------------------------------------
  **Web crawl         Large coverage, broad domain sampling, archival snapshots, economical for large scale use.                                               Noisy, duplicates, stale content, robots.txt / crawler-blocking, bias toward popular or well-linked pages.
  archives (e.g.                                                                                                                                               
  Common Crawl)**                                                                                                                                              

  **Community / forum Rich conversational text, covering niche topics, informal language, many perspectives. Reddit in particular has historically been used   Moderation, spam, low signal-to-noise, potential copyright / licensing / scraping restrictions. Also, Reddit has recently moved to
  sites (Reddit,      (e.g. WebText). ([[THE                                                                                                                   restrict or license use of its content for AI training. ([[THE
  StackExchange,      DECODER]{.underline}](https://the-decoder.com/reddit-ends-its-role-as-a-free-ai-training-data-goldmine/?utm_source=chatgpt.com))         DECODER]{.underline}](https://the-decoder.com/reddit-ends-its-role-as-a-free-ai-training-data-goldmine/?utm_source=chatgpt.com))
  etc.)**                                                                                                                                                      

  **High-quality      Strong credibility, authority, factual verification. Models often prefer citing or using these sources when available. ([[Search Engine  Access restrictions (paywalls), updating / freshness, copyright, variance in domain coverage.
  references (news    Land]{.underline}](https://searchengineland.com/how-generative-engines-define-rank-trustworthy-content-461575?utm_source=chatgpt.com))   
  outlets, academic                                                                                                                                            
  journals,                                                                                                                                                    
  government, domain                                                                                                                                           
  experts)**                                                                                                                                                   

  **Structured /      Well-organized, well-maintained, with internal linking and entity structure.                                                             Not always deep or current in niche domains; may lack granular detail.
  semi-structured                                                                                                                                              
  sources (Wikipedia,                                                                                                                                          
  knowledge bases,                                                                                                                                             
  official                                                                                                                                                     
  datasets)**                                                                                                                                                  

  **Licensed /        Some AI platforms license content from publishers / data providers to improve coverage / legal compliance.                               Cost, negotiating rights, versioning, updates.
  proprietary                                                                                                                                                  
  content**                                                                                                                                                    

  **User-generated    Gives texture, variety, nuance, long-tail topics, and diverse viewpoints.                                                                High variance in quality, risk of misinformation, bias, outdated content, or intentionally manipulated content.
  content (blogs, Q&A                                                                                                                                          
  sites, niche                                                                                                                                                 
  communities, social                                                                                                                                          
  media)**                                                                                                                                                     
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**One recent trend: platforms like Reddit are increasingly restricting
scraping or licensing their data to AI companies, which may reduce their
freely available usage in future models.**

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Model / Platform**  **Known data / citation architecture**                                                                                                                                                 **Clues / estimates of source shares**                                                                                                  **Uncertainties /
                                                                                                                                                                                                                                                                                                                                                       caveats**
  --------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------- -----------------
  **OpenAI / ChatGPT /  \- OpenAI states their foundation models are trained on a mix of: (1) information publicly available on the internet, (2) data from third-party partnerships, (3) user / human trainer \- For earlier models, there is an oft-cited (though not formally confirmed) breakdown for *GPT-3 training mix*: \~60% from filtered    \- OpenAI does
  GPT family (e.g.      / researcher contributions. ([[OpenAI Help                                                                                                                                             Common Crawl, \~22% WebText2 (Reddit-derived), \~8% books, \~8% other book data, \~3% Wikipedia. (From public commentary / reverse      **not** publish
  GPT-4, GPT-4o,        Center]{.underline}](https://help.openai.com/en/articles/7842364-how-chatgpt-and-our-foundation-models-are-developed?utm_source=chatgpt.com)) - They run data partnerships (i.e.       engineering)                                                                                                                            up-to-date,
  etc.)**               licensed sources) to augment coverage. ([[OpenAI]{.underline}](https://openai.com/index/data-partnerships/?utm_source=chatgpt.com)) - In use, ChatGPT may rely on retrieval /          ([[Springboard]{.underline}](https://www.springboard.com/blog/data-science/machine-learning-gpt-3-open-ai/?utm_source=chatgpt.com)) -   fine-grained
                        knowledge augmentation for up-to-date content via "actions" or "tools" (e.g. web retrieval, browser, plugins) as allowed. ([[OpenAI                                                    Since Wikipedia is small in raw web size, but is upweighted or emphasized, it may get a higher share in *citations / grounding* than    percentages of
                        Platform]{.underline}](https://platform.openai.com/docs/actions/data-retrieval?utm_source=chatgpt.com))                                                                                its token share in training. - In observed external analyses of citations in ChatGPT responses, some sources (blogs, major news,        how much output
                                                                                                                                                                                                               Wikipedia) appear disproportionately. (E.g. analysis in TryProfound's "AI Platform Citation Patterns")                                  is drawn / cited
                                                                                                                                                                                                               ([[Profound]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com))                       from Reddit vs
                                                                                                                                                                                                                                                                                                                                                       blogs vs news vs
                                                                                                                                                                                                                                                                                                                                                       Wikipedia. - The
                                                                                                                                                                                                                                                                                                                                                       "training mix"
                                                                                                                                                                                                                                                                                                                                                       (what the model
                                                                                                                                                                                                                                                                                                                                                       learned from)
                                                                                                                                                                                                                                                                                                                                                       does not directly
                                                                                                                                                                                                                                                                                                                                                       translate to what
                                                                                                                                                                                                                                                                                                                                                       is *cited* or
                                                                                                                                                                                                                                                                                                                                                       *used* at
                                                                                                                                                                                                                                                                                                                                                       inference time,
                                                                                                                                                                                                                                                                                                                                                       especially when
                                                                                                                                                                                                                                                                                                                                                       retrieval
                                                                                                                                                                                                                                                                                                                                                       components are
                                                                                                                                                                                                                                                                                                                                                       involved. -
                                                                                                                                                                                                                                                                                                                                                       Retrieval / tool
                                                                                                                                                                                                                                                                                                                                                       augmentation can
                                                                                                                                                                                                                                                                                                                                                       dramatically
                                                                                                                                                                                                                                                                                                                                                       change
                                                                                                                                                                                                                                                                                                                                                       proportions
                                                                                                                                                                                                                                                                                                                                                       depending on
                                                                                                                                                                                                                                                                                                                                                       query domain,
                                                                                                                                                                                                                                                                                                                                                       freshness needs,
                                                                                                                                                                                                                                                                                                                                                       or policy
                                                                                                                                                                                                                                                                                                                                                       filters.

  **Perplexity (Sonar + \- Perplexity uses a custom LLM family (Sonar) plus real-time web retrieval / search infrastructure, anchoring responses to live sources with inline citations. ([[Data Studios        \- In external analyses / blog articles, Perplexity is reported to show high citation rates for Reddit in some topics (e.g. "Perplexity \- We don't have
  live retrieval)**     ‧Exafin]{.underline}](https://www.datastudios.org/post/how-to-use-perplexity-ai-for-effective-research-with-real-time-sources-file-uploads-and-citation-t?utm_source=chatgpt.com)) -   heavily favors Reddit: \~47%") in observed outputs (but this is anecdotal / not from official data). (Claimed by Sentisight, as quoted  an official
                        The model is not purely generative: it emphasizes *verified sources / live web* in its architecture.                                                                                   in earlier discussions) - In TryProfound's "Citation Patterns," Perplexity's top-cited domains differ from ChatGPT and Google AI        breakdown of how
                        ([[answers.businesslibrary.uflib.ufl.edu]{.underline}](https://answers.businesslibrary.uflib.ufl.edu/genai/faq/413612?utm_source=chatgpt.com))                                         Overviews, indicating a distinct source preference mix.                                                                                 many citations in
                                                                                                                                                                                                               ([[Profound]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)) - Because Perplexity  Perplexity are
                                                                                                                                                                                                               is anchored to the *live web*, its share of fresh news / recent blogs / web sources may be higher (especially for recent events) than   from Reddit vs
                                                                                                                                                                                                               static corpora sources.                                                                                                                 mainstream news
                                                                                                                                                                                                                                                                                                                                                       vs niche blogs vs
                                                                                                                                                                                                                                                                                                                                                       academic
                                                                                                                                                                                                                                                                                                                                                       sources. - The
                                                                                                                                                                                                                                                                                                                                                       observed "47%
                                                                                                                                                                                                                                                                                                                                                       Reddit" claims
                                                                                                                                                                                                                                                                                                                                                       are not
                                                                                                                                                                                                                                                                                                                                                       independently
                                                                                                                                                                                                                                                                                                                                                       verified and may
                                                                                                                                                                                                                                                                                                                                                       reflect sample
                                                                                                                                                                                                                                                                                                                                                       bias or specific
                                                                                                                                                                                                                                                                                                                                                       topic domains. -
                                                                                                                                                                                                                                                                                                                                                       The exact
                                                                                                                                                                                                                                                                                                                                                       weighting between
                                                                                                                                                                                                                                                                                                                                                       the LLM component
                                                                                                                                                                                                                                                                                                                                                       and retrieval
                                                                                                                                                                                                                                                                                                                                                       module may shift
                                                                                                                                                                                                                                                                                                                                                       over time as
                                                                                                                                                                                                                                                                                                                                                       Perplexity
                                                                                                                                                                                                                                                                                                                                                       evolves.

  **Google / Google's   \- Google likely combines its massive web index (Search) with generative summarization / answer generation over top results. (It is a hybrid: traditional search + generative layer) - \- In TryProfound's "AI Platform Citation Patterns," Google AI Overviews show distinct source dominance patterns (less reliance on      \- Google doesn't
  generative hybrid     Their indexing covers the traditional web (news, blogs, forums, etc.), plus structured data, Knowledge Graph, etc. - Their "ranking" layer already has mature signals (PageRank,       Reddit, more on high-authority or domain sources).                                                                                      publish a
  (e.g. AI Overviews /  authority, recency, link data).                                                                                                                                                        ([[Profound]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)) - In broad external   breakdown of
  SGE)**                                                                                                                                                                                                       commentary, Wikipedia is often overrepresented in "AI answers" relative to its raw web share; Google likely draws heavily on curated    "what percent of
                                                                                                                                                                                                               data / structured / high-authority sources for factual questions.                                                                       its generative
                                                                                                                                                                                                                                                                                                                                                       output cites
                                                                                                                                                                                                                                                                                                                                                       Reddit vs blogs
                                                                                                                                                                                                                                                                                                                                                       vs news vs
                                                                                                                                                                                                                                                                                                                                                       Wikipedia." - The
                                                                                                                                                                                                                                                                                                                                                       hybrid
                                                                                                                                                                                                                                                                                                                                                       architecture
                                                                                                                                                                                                                                                                                                                                                       means proportions
                                                                                                                                                                                                                                                                                                                                                       can vary heavily
                                                                                                                                                                                                                                                                                                                                                       by query type
                                                                                                                                                                                                                                                                                                                                                       (current event vs
                                                                                                                                                                                                                                                                                                                                                       historical vs
                                                                                                                                                                                                                                                                                                                                                       technical). -
                                                                                                                                                                                                                                                                                                                                                       Some sources may
                                                                                                                                                                                                                                                                                                                                                       be suppressed or
                                                                                                                                                                                                                                                                                                                                                       de-prioritized
                                                                                                                                                                                                                                                                                                                                                       depending on
                                                                                                                                                                                                                                                                                                                                                       content policies
                                                                                                                                                                                                                                                                                                                                                       or site quality
                                                                                                                                                                                                                                                                                                                                                       assessments.

  **Claude / Anthropic  \- Anthropic (Claude) uses a blend of public text, licensed sources, and curated data; they emphasize safety, filtering, and alignment (thus may downweight low-quality or unverified  \- There is less public granular data on citation source breakdowns for Claude. - In some benchmarking and comparative studies, Claude  \- Because
  models**              sources). (Public statements) - In deployments, Claude may be paired with retrieval modules (connect to search or document corpora) depending on the application.                      tends to show more cautious sourcing and a higher premium on authoritative sources, which suggests relatively lower reliance on forums  Anthropic is more
                                                                                                                                                                                                               or social media content. (From qualitative analysis)                                                                                    closed about its
                                                                                                                                                                                                                                                                                                                                                       inner training
                                                                                                                                                                                                                                                                                                                                                       and inference
                                                                                                                                                                                                                                                                                                                                                       weighting, we
                                                                                                                                                                                                                                                                                                                                                       lack good
                                                                                                                                                                                                                                                                                                                                                       empirical
                                                                                                                                                                                                                                                                                                                                                       shares. - Much
                                                                                                                                                                                                                                                                                                                                                       depends on the
                                                                                                                                                                                                                                                                                                                                                       application
                                                                                                                                                                                                                                                                                                                                                       (Claude in a
                                                                                                                                                                                                                                                                                                                                                       "web-connected"
                                                                                                                                                                                                                                                                                                                                                       mode vs isolated
                                                                                                                                                                                                                                                                                                                                                       closed model).

  **Other domain /      \- Many custom systems (e.g. enterprise GPTs, vector search + LLM) rely heavily on the connected document corpus (internal data, domain databases, partner content) because that is    \- In those cases, the "percentage from web" may be small or zero (if the model is confined to client data), or might mirror the        \- Because they
  custom                their anchoring source. - These systems may disable or limit general web retrieval, or combine with search.                                                                            proportions of the web subset they allow (if they allow web retrieval) - In systems like "GPTs on your own data" (e.g. Azure's "On Your are customized,
  retrieval-augmented                                                                                                                                                                                          Data"), the influence of public web sources is minimized. ([[Microsoft                                                                  there is no
  models**                                                                                                                                                                                                     Learn]{.underline}](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/use-your-data?utm_source=chatgpt.com))           "average"
                                                                                                                                                                                                                                                                                                                                                       breakdown --- it
                                                                                                                                                                                                                                                                                                                                                       depends entirely
                                                                                                                                                                                                                                                                                                                                                       on configuration
                                                                                                                                                                                                                                                                                                                                                       and
                                                                                                                                                                                                                                                                                                                                                       restrictions. -
                                                                                                                                                                                                                                                                                                                                                       The share of
                                                                                                                                                                                                                                                                                                                                                       output drawn from
                                                                                                                                                                                                                                                                                                                                                       "public web" vs
                                                                                                                                                                                                                                                                                                                                                       internal corpora
                                                                                                                                                                                                                                                                                                                                                       can shift
                                                                                                                                                                                                                                                                                                                                                       dynamically by
                                                                                                                                                                                                                                                                                                                                                       query.
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

One of the more comprehensive public analyses is from TryProfound, which
tracked **680 million citations** across ChatGPT, Google AI Overviews,
and Perplexity.
[[Profound]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)
Their breakdowns:

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Platform**     **Wikipedia**           **Reddit**   **Other top sources (blogs, publishers)**
  ---------------- ----------------------- ------------ -----------------------------------------------------------------------------------------------------------------
  **ChatGPT**      \~ 7.8 % of total       \~ 1.8 %     Others: Forbes 1.1 %, G2 1.1 %, etc.
                   citations                            [[Profound]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)

  **Google AI      \~ 0.6 %                \~ 2.2 %     Other: YouTube 1.9 %, Quora 1.5 %, LinkedIn 1.3 %
  Overviews**                                           [[Profound]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)

  **Perplexity**   (not listed explicitly  \~ 6.6 %     YouTube 2.0 %, Gartner 1.0 %, etc.
                   in TryProfound for                   [[Profound]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)
                   Wikipedia)                           
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------

Ahrefs found that \~76.1% of pages cited in AI Overviews are from within
the *top 10* search results. [[Ahrefs\
]{.underline}](https://ahrefs.com/blog/search-rankings-ai-citations/?utm_source=chatgpt.com)

In another study, Writesonic finds \~40.58% of AI citations come from
Google's top 10 results. [[Writesonic\
]{.underline}](https://writesonic.com/blog/ai-citations-from-serp-results-study?utm_source=chatgpt.com)

Also, many AI Overviews citations overlap with top-100 search results
(i.e. very high ranking pages).
[[Ahrefs+2Originality.ai+2]{.underline}](https://ahrefs.com/blog/search-rankings-ai-citations/?utm_source=chatgpt.com)

**ChatGPT (in TryProfound's sample):\
** -- Wikipedia: \~7.8 % of citations [[Profound\
]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)
-- Reddit: \~1.8 % [[Profound\
]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)
-- The remaining \~90+ % is drawn from blogs, news, publisher websites,
etc.

**Google AI Overviews (in same sample):\
** -- Wikipedia: \~0.6 % [[Profound\
]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)
-- Reddit: \~2.2 % [[Profound\
]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)
-- The rest are from YouTube, Quora, LinkedIn, mainstream publishers
[[Profound\
]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)

**Perplexity (in that same sample):\
** -- Reddit: \~6.6 % [[Profound\
]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)
-- Others: YouTube 2.0 %, Gartner 1.0 %, etc. [[Profound\
]{.underline}](https://www.tryprofound.com/blog/ai-platform-citation-patterns?utm_source=chatgpt.com)
-- Wikipedia share not broken out in their top source list in that
article, but presumably lower or embedded in the general pool.
