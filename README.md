# ClinTrial

## 1. Project Overview

ClinTrial is a web application for searching, comparing, and mapping studies from [ClinicalTrials.gov](https://clinicaltrials.gov/). It combines a React interface with an Express API and Redis storage. The backend imports and normalizes study records, builds searchable indexes, and serves trial search, map, analytics, and AI-assisted search features.

## 2. Technology Stack

- **Frontend:** React 19, Vite 8, Leaflet, React Leaflet, Recharts, Lucide icons
- **Backend:** Node.js, Express 5, Axios, dotenv
- **Storage and indexing:** Redis 7, with Redis sets for trial and geographic indexes
- **Study source:** ClinicalTrials.gov API v2
- **AI search:** Ollama (optional; required to use natural-language AI search)
- **Local infrastructure:** Docker Compose for Redis

## 3. Key Features

- Search studies by condition, intervention or drug, recruitment status, phase, country, and year range.
- Browse paginated study results and view study locations on an interactive map.
- Explore map locations in geographic clusters and load site details a page at a time.
- Review analytics for status, phase, sponsor, country, and study start year.
- Ask natural-language questions about the indexed studies using the AI workspace.
- Use cached search and analytics results to reduce repeat work and API calls.

## 4. Project Architecture

```drawio
<mxfile>
  <diagram id="DAulXwdK3n1gwsmV8WTL" name="Page-1">
    <mxGraphModel dx="639" dy="1033" grid="1" gridSize="10" guides="1" tooltips="0" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <UserObject label="" mermaidData="{&#xa;  &quot;data&quot;: &quot;flowchart TD\n    CTG[ClinicalTrials.gov API v2] --&gt;|paged import| Sync[Backend sync script]\n    Sync --&gt;|normalized study records| Redis[(Redis)]\n    Redis --&gt;|source records| Indexer[Manual index builder]\n    Indexer --&gt;|versioned search and geo indexes| Redis\n    Browser[React and Vite frontend] --&gt;|REST requests| API[Express backend]\n    API --&gt;|search, map, analytics, cache| Redis\n    API --&gt;|enums, countries, version| CTG\n    API --&gt;|optional natural-language requests| Ollama[Ollama]&quot;,&#xa;  &quot;config&quot;: null&#xa;}" id="17">
          <mxCell connectable="0" parent="1" style="group;transparentBounds=1;editIcon=1;lockedGroup=0;groupPadding=10;" vertex="1">
            <mxGeometry as="geometry" />
          </mxCell>
        </UserObject>
        <UserObject label="ClinicalTrials.gov API v2" mermaidId="n:CTG" mermaidBaseStyle="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" mermaidBaseValue="ClinicalTrials.gov API v2" id="2">
          <mxCell parent="17" style="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" vertex="1">
            <mxGeometry height="54" width="229" x="10" y="256" as="geometry" />
          </mxCell>
        </UserObject>
        <UserObject label="Backend sync script" mermaidId="n:Sync" mermaidBaseStyle="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" mermaidBaseValue="Backend sync script" id="3">
          <mxCell parent="17" style="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" vertex="1">
            <mxGeometry height="54" width="201" x="24" y="379" as="geometry" />
          </mxCell>
        </UserObject>
        <UserObject label="Redis" mermaidId="n:Redis" mermaidBaseStyle="html=1;shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;strokeWidth=1;whiteSpace=wrap;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" mermaidBaseValue="Redis" id="4">
          <mxCell parent="17" style="html=1;shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;strokeWidth=1;whiteSpace=wrap;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" vertex="1">
            <mxGeometry height="67" width="52" x="290" y="502" as="geometry" />
          </mxCell>
        </UserObject>
        <UserObject label="Manual index builder" mermaidId="n:Indexer" mermaidBaseStyle="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" mermaidBaseValue="Manual index builder" id="5">
          <mxCell parent="17" style="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" vertex="1">
            <mxGeometry height="54" width="210" x="211" y="638" as="geometry" />
          </mxCell>
        </UserObject>
        <UserObject label="React and Vite frontend" mermaidId="n:Browser" mermaidBaseStyle="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" mermaidBaseValue="React and Vite frontend" id="6">
          <mxCell parent="17" style="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" vertex="1">
            <mxGeometry height="54" width="232" x="246" y="10" as="geometry" />
          </mxCell>
        </UserObject>
        <UserObject label="Express backend" mermaidId="n:API" mermaidBaseStyle="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" mermaidBaseValue="Express backend" id="7">
          <mxCell parent="17" style="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" vertex="1">
            <mxGeometry height="54" width="178" x="273" y="133" as="geometry" />
          </mxCell>
        </UserObject>
        <UserObject label="Ollama" mermaidId="n:Ollama" mermaidBaseStyle="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" mermaidBaseValue="Ollama" id="8">
          <mxCell parent="17" style="html=1;whiteSpace=wrap;strokeWidth=1;fillColor=light-dark(#ECECFF,#1f2020);strokeColor=light-dark(#9370DB,#cccccc);fontColor=light-dark(#333333,#cccccc);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontSize=16;" vertex="1">
            <mxGeometry height="54" width="110" x="307" y="256" as="geometry" />
          </mxCell>
        </UserObject>
        <UserObject label="paged import" mermaidId="e:CTG-&gt;Sync#0" mermaidBaseStyle="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.5;exitY=1;entryX=0.5;entryY=0;" mermaidBaseValue="paged import" id="9">
          <mxCell edge="1" parent="17" source="2" style="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.5;exitY=1;entryX=0.5;entryY=0;" target="3">
            <mxGeometry relative="1" as="geometry">
              <Array as="points" />
            </mxGeometry>
          </mxCell>
        </UserObject>
        <UserObject label="normalized study records" mermaidId="e:Sync-&gt;Redis#0" mermaidBaseStyle="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.5;exitY=1;entryX=0;entryY=0.36;" mermaidBaseValue="normalized study records" id="10">
          <mxCell edge="1" parent="17" source="3" style="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.5;exitY=1;entryX=0;entryY=0.36;" target="4">
            <mxGeometry relative="1" as="geometry">
              <Array as="points">
                <mxPoint x="125" y="468" />
              </Array>
            </mxGeometry>
          </mxCell>
        </UserObject>
        <UserObject label="source records" mermaidId="e:Redis-&gt;Indexer#0" mermaidBaseStyle="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.75;exitY=1;entryX=0.5619047619047619;entryY=0;curved=1;exitX=0.75;exitY=1;entryX=0.56;entryY=0;" mermaidBaseValue="source records" id="11">
          <mxCell edge="1" parent="17" source="4" style="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.75;exitY=1;entryX=0.56;entryY=0;" target="5">
            <mxGeometry relative="1" as="geometry">
              <mxPoint as="offset" />
              <Array as="points">
                <mxPoint x="381" y="604" />
              </Array>
            </mxGeometry>
          </mxCell>
        </UserObject>
        <UserObject label="versioned search and geo indexes" mermaidId="e:Indexer-&gt;Redis#0" mermaidBaseStyle="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.4380952380952381;exitY=0;entryX=0.25;entryY=1;curved=1;exitX=0.44;exitY=0;entryX=0.25;entryY=1;" mermaidBaseValue="versioned search and geo indexes" id="12">
          <mxCell edge="1" parent="17" source="5" style="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.44;exitY=0;entryX=0.25;entryY=1;" target="4">
            <mxGeometry relative="1" as="geometry">
              <mxPoint as="offset" />
              <Array as="points">
                <mxPoint x="184" y="604" />
              </Array>
            </mxGeometry>
          </mxCell>
        </UserObject>
        <UserObject label="REST requests" mermaidId="e:Browser-&gt;API#0" mermaidBaseStyle="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.5;exitY=1;entryX=0.5;entryY=0;" mermaidBaseValue="REST requests" id="13">
          <mxCell edge="1" parent="17" source="6" style="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.5;exitY=1;entryX=0.5;entryY=0;" target="7">
            <mxGeometry relative="1" as="geometry">
              <Array as="points" />
            </mxGeometry>
          </mxCell>
        </UserObject>
        <UserObject label="search, map, analytics, cache" mermaidId="e:API-&gt;Redis#0" mermaidBaseStyle="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.86;exitY=1;entryX=1;entryY=0.36;" mermaidBaseValue="search, map, analytics, cache" id="14">
          <mxCell edge="1" parent="17" source="7" style="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.86;exitY=1;entryX=1;entryY=0.36;" target="4">
            <mxGeometry relative="1" as="geometry">
              <Array as="points">
                <mxPoint x="507" y="222" />
                <mxPoint x="507" y="283" />
                <mxPoint x="507" y="345" />
                <mxPoint x="507" y="406" />
                <mxPoint x="507" y="468" />
              </Array>
            </mxGeometry>
          </mxCell>
        </UserObject>
        <UserObject label="enums, countries, version" mermaidId="e:API-&gt;CTG#0" mermaidBaseStyle="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0;exitY=0.93;entryX=0.5;entryY=0;" mermaidBaseValue="enums, countries, version" id="15">
          <mxCell edge="1" parent="17" source="7" style="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0;exitY=0.93;entryX=0.5;entryY=0;" target="2">
            <mxGeometry relative="1" as="geometry">
              <Array as="points">
                <mxPoint x="125" y="222" />
              </Array>
            </mxGeometry>
          </mxCell>
        </UserObject>
        <UserObject label="optional natural-language requests" mermaidId="e:API-&gt;Ollama#0" mermaidBaseStyle="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.5;exitY=1;entryX=0.5;entryY=0;" mermaidBaseValue="optional natural-language requests" id="16">
          <mxCell edge="1" parent="17" source="7" style="curved=1;startArrow=none;endArrow=block;endSize=7;strokeColor=light-dark(#333333,#cccccc);html=1;fontSize=16;labelBackgroundColor=light-dark(#E8E8E88D,#2a2a2a8D);fontFamily=Trebuchet MS,Verdana,Arial,sans-serif;fontColor=light-dark(#333333,#cccccc);exitX=0.5;exitY=1;entryX=0.5;entryY=0;" target="8">
            <mxGeometry relative="1" as="geometry">
              <Array as="points" />
            </mxGeometry>
          </mxCell>
        </UserObject>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>

```

The backend starts the paginated import when the server starts, unless Redis already has the successful-import flag. The importer normalizes studies and stores each trial in Redis. After the import completes, run the separate index builder. Search, map, and analytics endpoints use the active Redis index version.

Repository layout:

```text
clinical_trial_map_backend/    Express API, Redis config, sync and index scripts
clinical_trial_map_frontend/   React application
README.md                      This guide
```

## 5. Installation and Setup

### Prerequisites

- Node.js and npm
- Docker with Docker Compose
- An internet connection for the initial study import and ClinicalTrials.gov metadata
- Ollama and a locally available model if you plan to use AI search

### Backend Setup

From the repository root:

```sh
cd clinical_trial_map_backend
npm install
```

Create a local environment file by copying the example:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead. Set the backend variables in `.env`; the values below are placeholders to replace with your local configuration:

```dotenv
CLINICAL_TRIALS_API_URL=your-clinical-trials-api-url
PORT=your-backend-port
REDIS_URL=your-redis-connection-url
OLLAMA_URL=your-ollama-url
OLLAMA_MODEL=your-ollama-model
```

Start Redis from the backend directory:

```sh
docker compose up -d redis
```

Start the API:

```sh
npm run dev
```

The server connects to Redis and starts importing studies in the background. The first import can take a while. The importer saves a page checkpoint and resumes from it after an interrupted run. Wait for the `Import completed` message before building indexes.

In a second terminal, from `clinical_trial_map_backend`, build the Redis indexes:

```sh
node scripts/buildTrialIndexes.js
```

Index building is a separate step and is not automatically started by the server. The frontend's search, map, and analytics features need an active index.

### Frontend Setup

From the repository root:

```sh
cd clinical_trial_map_frontend
npm install
```

Copy the environment example:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env`. Replace the frontend placeholder with your backend API base URL:

```dotenv
VITE_API_BASE_URL=your-backend-api-base-url
```

Start the Vite development server:

```sh
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### Environment Variables

| Variable                  | Application | Purpose                                     |
| ------------------------- | ----------- | ------------------------------------------- |
| `CLINICAL_TRIALS_API_URL` | Backend     | ClinicalTrials.gov API v2 studies endpoint. |
| `PORT`                    | Backend     | Optional Express listening port.            |
| `REDIS_URL`               | Backend     | Redis connection URL.                       |
| `OLLAMA_URL`              | Backend     | Ollama service endpoint.                    |
| `OLLAMA_MODEL`            | Backend     | Identifier for an installed Ollama model.   |
| `VITE_API_BASE_URL`       | Frontend    | Backend API base URL, including `/api`.     |

AI search requires Ollama to be running with the configured model available. The rest of the application does not use Ollama.

## 6. API Documentation

All backend routes use the `/api` prefix. Search, map, and analytics accept the common filters `condition`, `drug`, `status`, `phase`, `country`, `startYear`, `startYearFrom`, and `endYear` where applicable.

| Method and path                          | Purpose                                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/trials`                        | Search and page through matching trials. Supports common filters plus `pageSize` and `pageToken`.                                                                       |
| `GET /api/trials/map`                    | Return map summary points for the selected filters.                                                                                                                     |
| `GET /api/trials/map/cluster-details`    | Page through sites in one map cell. Requires `latitude` and `longitude`; accepts filters plus `limit` and `offset`.                                                     |
| `GET /api/analytics`                     | Return aggregate analytics for the selected filters.                                                                                                                    |
| `GET /api/clinical-trials/studies/enums` | Return ClinicalTrials.gov enum values used by the filter UI and backend validation.                                                                                     |
| `GET /api/clinical-trials/version`       | Return the ClinicalTrials.gov API version shown in the UI.                                                                                                              |
| `GET /api/clinical-trials/countries`     | Return the country options used by the filter UI.                                                                                                                       |
| `POST /api/ai/search`                    | Answer a natural-language question and return matching studies. The JSON body accepts `question`, `pageSize`, `pageToken`, `contextFilters`, and `conversationContext`. |

Example trial search:

```sh
curl "http://localhost:5000/api/trials?condition=diabetes&pageSize=10"
```

Trial search accepts page sizes from 1 to 1,000. Cluster details return at most 100 sites per request (50 by default); use `offset` to request another page.

## 7. Technical Decisions and Limitations

- **Many sites per trial:** A study can have many locations. The index builder creates geographic buckets at one-degree precision, and the map API returns aggregated points with location and trial counts. Leaflet also clusters nearby points. Selecting a bucket loads site details in pages rather than placing every site in the initial map response. This keeps the overview smaller and easier to navigate, but nearby sites in the same one-degree cell are represented together.
- **Missing coordinates:** The study record is retained for search and analytics, but a site without valid latitude and longitude is omitted from the map. A study may still appear on the map through its other geocoded sites. The current map does not provide a separate view for unmapped sites.
- **Combined phases:** Analytics splits combined phase labels on `/` and counts a trial once in each distinct phase it contains. For example, a Phase 2/Phase 3 study contributes one to Phase 2 and one to Phase 3. The phase counts therefore can add up to more than the total number of studies.
- **Caching:** Search result sets and map and analytics responses are cached in Redis to speed up repeated requests. Search result sets expire after five minutes; map and analytics responses expire after one hour. ClinicalTrials.gov metadata is cached for one hour and the country list for 24 hours. Cached responses can be stale until their TTL expires.
- **Import and indexes:** The initial dataset import is large and runs separately from index building. Indexes must be built after a successful import. The importer skips future full imports once Redis marks the dataset complete; an incremental refresh workflow is not currently provided.
- **AI dependency:** Natural-language search depends on a reachable Ollama server and an installed model. It is optional and is not needed for standard search, map, or analytics features.

## 8. AI Tools Usage

### AI Tools Used

- **ChatGPT:** Used as a development assistant throughout the project for requirement analysis, technical guidance, problem-solving, and documentation.
- **Ollama (Qwen 3.5 – 9B):** Integrated a locally hosted, pre-trained Large Language Model (LLM) into the application to enable AI-powered natural-language clinical trial search.

### Areas of AI Assistance

- **Use Case Understanding:** Used ChatGPT to understand the project requirements, identify the core functionalities, and determine the APIs and integrations needed.
- **Requirement Analysis:** Explored different implementation approaches and broke down complex requirements into manageable development tasks.
- **Technical Guidance:** Discussed suitable technologies, libraries, tools, and architectural approaches for implementing specific functionalities.
- **Code Assistance:** Consulted ChatGPT for code examples, implementation guidance, and explanations of unfamiliar or complex code.
- **Debugging and Problem-Solving:** Used ChatGPT to analyze errors, investigate potential causes, and explore alternative solutions.
- **Database and Performance:** Explored approaches to data indexing, Redis caching, pagination, and efficient handling of large datasets.
- **Documentation and Presentation:** Assisted in structuring technical documentation, preparing the README, and explaining architectural and technical decisions.

### Actual AI Implementation

- Integrated Ollama with the Qwen 3.5 (9B) pre-trained model.
- Implemented natural-language query processing to interpret user search requests.
- Converted AI-interpreted queries into structured search parameters.
- Connected the generated parameters to the existing backend search functionality.
- Designed AI search as an optional feature, allowing users to continue using standard search functionality independently.

## 9. Future Improvements

- Add an incremental or scheduled data refresh and a documented way to rebuild the dataset safely.
- Trigger index building automatically after a successful import, with progress and failure status exposed to the UI.
- Show sites without coordinates in a dedicated list and improve geocoding coverage.
- Make map bucket precision adapt to zoom level and show more detailed grouping at closer zooms.
- Add automated tests for sync recovery, indexing, filters, pagination, caching, and combined-phase analytics.
- Add representative screenshots and a hosted demo link.

