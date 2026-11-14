<?php
// Editorial discussion prompts of Academia Institute.
// These are questions from the editorial office that open a discussion. They are always
// shown as "Editorial question · Academia Institute" and are never presented as comments
// written by readers or researchers.
//
// Loaded once into the discussion_prompts table (see discussion_lib.php); after that the
// editors manage the library from the Discussions page.
//
// "journal" ties a prompt to one journal; "keywords" (comma separated) make it appear
// only on articles whose title, keywords or abstract contain one of those words.

if (basename($_SERVER["SCRIPT_FILENAME"] ?? "") === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

$general = [

    "appreciation" => [
        "Which contribution of this work do you find most useful for your own research, and why?",
        "What aspect of this study would you highlight to a colleague who works outside this field?",
        "Research of this kind often takes years of preparation. Which part of the work do you think required the most careful effort?",
        "If you were introducing this publication at a seminar, which idea would you open with?",
        "Which question raised by the authors do you consider especially timely for the research community?",
        "What does this work add to the conversation that was missing before?",
        "Which earlier studies does this publication build on most clearly, in your view?",
        "Is there a section of this work that you would recommend as reading for graduate students?",
        "How does this contribution compare with other recent work you have read on the same subject?",
        "Which element of the presentation — data, structure or argument — made the work easiest to follow?",
        "What would you say is the lasting value of this research beyond its immediate results?",
        "Which part of this publication would you like to see developed into a longer study?",
        "How might this work be useful to researchers who are just beginning in this area?",
        "Which idea in this publication stayed with you after reading it?",
        "In what way could this research encourage further work in your own institution?",
    ],

    "reflection" => [
        "How does this topic connect with debates that have shaped the field over the past decade?",
        "Which assumptions underlying this line of research would you like to see examined more closely?",
        "What broader questions does this work raise for the discipline as a whole?",
        "Are there established theories that this research invites us to reconsider?",
        "How might the conclusions of studies like this change if the context were different?",
        "What would it take for ideas in this area to move from promising to widely accepted?",
        "Which tensions or trade-offs in this subject deserve more open discussion?",
        "How do you see the relationship between this research and long-standing problems in the field?",
        "What would you consider the most important open question left by this topic?",
        "Which perspectives do you think are still under-represented in discussions of this subject?",
        "How has your own understanding of this topic changed as the field has developed?",
        "Where do you see the boundary between what is known and what is still uncertain in this area?",
        "What lessons from neighbouring fields could deepen the discussion of this topic?",
        "If this research area looks very different in ten years, what do you think will have changed it?",
        "Which concepts in this field would benefit from clearer shared definitions?",
    ],

    "interdisciplinary" => [
        "Which other disciplines could contribute meaningfully to research on this topic?",
        "How might researchers from the social sciences approach the questions raised here?",
        "Are there methods from another field that could be adapted to study this subject?",
        "What would a joint project between this field and engineering or computer science look like?",
        "Which problems in this area are difficult to solve within a single discipline?",
        "How could collaboration with practitioners outside academia enrich this research?",
        "Do you see connections between this topic and current work in environmental or health sciences?",
        "What vocabulary differences make interdisciplinary work on this subject challenging, and how might they be bridged?",
        "Which datasets or tools from other fields could open new directions for this research?",
        "How might economists, educators or policymakers interpret the issues discussed here?",
        "Have you seen successful cross-disciplinary projects on similar questions that could serve as a model?",
        "What could this field offer in return to the disciplines it draws upon?",
        "Which conferences or communities bring together researchers interested in this intersection?",
        "How might design, architecture or the humanities add perspective to this topic?",
        "What kind of team would be best placed to take this research a step further?",
    ],

    "future" => [
        "Which unanswered question in this area would you most like to see addressed next?",
        "How could this line of research be extended to different populations, regions or settings?",
        "What longer-term studies would help to test ideas in this field more thoroughly?",
        "Which emerging technologies could make new kinds of investigation possible here?",
        "If you were planning a follow-up study, what would you change or add?",
        "What data would researchers need to answer the next set of questions in this area?",
        "Which practical limitations currently hold back progress on this topic?",
        "Are there negative or inconclusive results in this area that deserve to be published and discussed?",
        "How might future research balance depth of analysis with wider applicability?",
        "What would a realistic research agenda for the next five years look like in this field?",
        "Which smaller questions could early-career researchers explore within this topic?",
        "How could replication studies strengthen confidence in work of this kind?",
        "What collaborations would accelerate future progress on this subject?",
        "Which directions in this field seem promising but remain largely unexplored?",
        "How might changing social or economic conditions shape the future of this research?",
    ],

    "methodology" => [
        "Which research design would you consider most appropriate for studying this question, and why?",
        "How can studies in this area make their data and procedures easier to reproduce?",
        "What are the strengths and limitations of qualitative and quantitative approaches to this topic?",
        "Which sources of bias are most important to account for in research of this kind?",
        "How should sample size and selection be approached when investigating this subject?",
        "What role could open data and shared code play in strengthening work in this field?",
        "Which validation steps would you expect to see before conclusions in this area are generalised?",
        "How might mixed-methods research add value to studies on this topic?",
        "What practical advice would you give to researchers designing their first study on this subject?",
        "Which measurement challenges are specific to this area of research?",
        "How do you decide when a pilot study is needed before a larger investigation?",
        "Which statistical or analytical choices tend to influence results most in this field?",
        "How can researchers report limitations in a way that is honest and still useful to readers?",
        "What makes a methodology section genuinely helpful to other researchers?",
        "Which recent methodological advances could improve research on this topic?",
    ],

    "applications" => [
        "Where do you see the most realistic practical applications of research in this area?",
        "Which organisations or sectors could benefit most from work on this topic?",
        "What obstacles usually stand between research findings of this kind and their use in practice?",
        "How could research in this field inform public policy or institutional decisions?",
        "What would a small pilot application of these ideas look like in practice?",
        "Which costs and benefits should be weighed before applying research of this kind?",
        "How might industry partners contribute to testing ideas in this area?",
        "Are there examples from your own experience where similar research has been put into practice?",
        "What evidence would decision-makers need before adopting approaches from this field?",
        "How could the results of research like this be communicated to non-specialists who might use them?",
        "Which local or regional needs could research on this topic help to address?",
        "What risks should be considered when moving from laboratory or model results to real settings?",
        "How might this research contribute to sustainable development goals?",
        "Which technologies or services could grow out of work in this area?",
        "What feedback from practitioners would be most valuable to researchers in this field?",
    ],

    "ethics" => [
        "Which ethical considerations are most relevant to research on this topic?",
        "How can researchers in this field ensure transparency about funding and potential conflicts of interest?",
        "What does responsible data handling look like for studies of this kind?",
        "How should researchers communicate uncertainty so that findings are not overstated?",
        "Which groups could be affected by research in this area, and how can their interests be respected?",
        "What role should informed consent play in this type of research?",
        "How can journals and reviewers support research integrity in this field?",
        "What are good practices for acknowledging the contributions of all members of a research team?",
        "How should researchers respond when later work raises questions about earlier findings?",
        "Which forms of research misconduct are hardest to detect in this area, and how can they be prevented?",
        "How might the benefits of this research be shared fairly across different communities?",
        "What responsibilities do researchers have when their work could be misused?",
        "How can open science practices strengthen trust in research on this topic?",
        "What guidance would you give students about citing sources responsibly in this field?",
        "How can editorial processes balance speed of publication with careful review?",
    ],

    "global" => [
        "How does research on this topic differ between countries or regions you are familiar with?",
        "What could researchers in Central Asia and other regions learn from each other on this subject?",
        "Which international collaborations have advanced this field, and what made them work?",
        "How do differences in funding and infrastructure shape research in this area around the world?",
        "Are findings in this field likely to apply equally across different cultural or economic contexts?",
        "What barriers prevent researchers in some countries from contributing fully to this field?",
        "How could international data sharing benefit research on this topic?",
        "Which global challenges is this research area well placed to address?",
        "How might language barriers affect the exchange of knowledge in this field?",
        "What role can international journals play in giving visibility to regional research?",
        "Which institutions or networks support cross-border cooperation in this area?",
        "How do national policies influence the direction of research on this subject?",
        "What local knowledge could enrich the international discussion of this topic?",
        "How can early-career researchers build international connections in this field?",
        "Which international standards or frameworks are most relevant to this area of research?",
    ],

    "education" => [
        "How could the ideas discussed here be introduced into university teaching?",
        "What background knowledge would help students engage with research on this topic?",
        "How can this field become more accessible to researchers from non-traditional backgrounds?",
        "What role can mentorship play in developing new researchers in this area?",
        "Which skills do you think are most important for students who want to work in this field?",
        "How could research on this topic be explained to secondary school students?",
        "What resources would you recommend to someone starting to learn about this subject?",
        "How can supervisors help students move from reading research to conducting it?",
        "What could universities do to support interdisciplinary training in this area?",
        "How might online courses or open materials widen access to knowledge in this field?",
        "Which common misconceptions about this topic would be worth addressing in teaching?",
        "How can early-career researchers gain experience in peer review and academic writing?",
        "What kinds of student projects could contribute to research on this subject?",
        "How might lifelong learning programmes include developments from this field?",
        "Which teaching approaches help learners connect research findings with practical work?",
    ],

    "dialogue" => [
        "Which part of this work would you like the authors to explain in more detail?",
        "Is there a point in this research where you see things differently? Please share your reasoning.",
        "What additional evidence would strengthen or challenge the arguments in this area?",
        "Which related studies would you suggest to readers interested in this topic?",
        "What questions would you put to the authors if you could speak with them directly?",
        "Are there alternative interpretations of this subject that deserve consideration?",
        "Which terms or concepts in this area would benefit from clarification for a wider audience?",
        "How might researchers with different views on this topic find common ground?",
        "What constructive suggestions would you offer for strengthening research in this field?",
        "Which aspects of this topic would you like to see discussed in a future issue of the journal?",
        "Is there practical experience you could share that relates to the questions raised here?",
        "What would help readers evaluate competing claims in this area?",
        "Which open questions here would make good topics for a joint discussion between researchers?",
        "How could the conversation around this topic include more voices from practice?",
        "What respectful disagreement in this field do you think is most productive?",
    ],
];

$by_journal = [

    "International Journal of Artificial Intelligence" => [
        ["ethics", "ai, artificial, intelligence, machine, learning, neural, model, algorithm, robot, robotics, autonomous", "How should responsibility be shared between developers, users and institutions when AI systems of this kind are deployed?"],
        ["methodology", "ai, machine, learning, neural, dataset, model, training, deep", "Which evaluation practices best show whether an AI model will perform reliably outside its training data?"],
        ["applications", "robot, robotics, autonomous, automation, control, intelligent, engineering", "What safety and reliability requirements should autonomous or robotic systems meet before use in real environments?"],
        ["interdisciplinary", "ai, artificial, intelligence, machine, learning, medical, education, engineering", "Which domain experts should be involved early when AI methods are applied to a specialised field?"],
        ["future", "ai, artificial, intelligence, machine, learning, neural, generative, language", "Which limitations of current AI approaches do you expect future research to address first?"],
    ],

    "International Journal of Architecture" => [
        ["applications", "architecture, building, design, urban, city, housing, construction", "How could design ideas of this kind be tested with the people who will actually use the space?"],
        ["global", "architecture, urban, city, heritage, housing, climate", "How should architectural research respond to differences in climate, culture and local building traditions?"],
        ["ethics", "urban, city, housing, public, space, heritage", "Whose needs should be given priority when research informs changes to public or shared spaces?"],
        ["future", "architecture, building, sustainable, energy, materials, digital, bim", "Which new materials or digital design tools are likely to change architectural research most in the coming years?"],
        ["education", "architecture, design, studio, students", "How can architectural education give students more experience with evidence-based design?"],
    ],

    "International Journal of Economics" => [
        ["methodology", "economic, economics, market, growth, model, econometric, data, panel", "Which data limitations most affect the reliability of economic analysis in this area?"],
        ["applications", "economic, policy, market, finance, trade, investment, development", "How could findings in this area inform economic policy without overlooking local conditions?"],
        ["global", "economic, trade, development, regional, kazakhstan, emerging", "How do economic questions of this kind look different in emerging and developed economies?"],
        ["ethics", "economic, inequality, income, poverty, welfare, labour", "How can economic research take distributional effects and vulnerable groups fully into account?"],
        ["future", "economic, digital, finance, innovation, green, sustainable", "Which economic changes over the next decade do you expect to reshape research on this topic?"],
    ],

    "International Journal of Education" => [
        ["methodology", "education, learning, students, teaching, school, assessment, classroom", "How can studies of learning outcomes separate the effect of a method from the influence of the classroom context?"],
        ["applications", "education, teaching, school, university, curriculum, learning", "What support would teachers need to apply approaches like these in everyday practice?"],
        ["ethics", "education, inclusive, inclusion, students, children, accessibility, disability", "How can educational research make sure that learners with different needs and backgrounds are fairly represented?"],
        ["global", "education, school, university, policy, international", "Which educational approaches travel well between countries, and which depend strongly on local context?"],
        ["future", "education, digital, online, technology, learning", "How do you expect digital tools to change the questions educational researchers ask?"],
    ],

    "International Journal of Energy Research" => [
        ["applications", "energy, renewable, solar, wind, power, grid, storage, battery", "What would it take for energy solutions of this kind to be adopted at scale in regions with limited infrastructure?"],
        ["methodology", "energy, efficiency, model, simulation, power, system", "How should simulation results in energy research be validated against field measurements?"],
        ["global", "energy, transition, renewable, policy, kazakhstan, emissions", "How might the energy transition look different in resource-rich economies compared with energy-importing ones?"],
        ["future", "energy, hydrogen, storage, battery, renewable, grid", "Which energy storage or conversion challenges do you consider most important for future research?"],
        ["ethics", "energy, access, poverty, emissions, climate", "How can energy research help ensure that the benefits of new technologies reach communities with limited access to energy?"],
    ],

    "International Journal of Engineering & Applied Physics" => [
        ["applications", "engineering, conveyor, mechanical, design, industrial, manufacturing, system, transport", "Which practical constraints — cost, maintenance, safety — should be considered first when moving an engineering design toward industrial use?"],
        ["methodology", "engineering, physics, simulation, experiment, measurement, model, finite", "How can experimental and simulation results be combined to give stronger confidence in engineering conclusions?"],
        ["future", "engineering, materials, sensors, automation, digital, monitoring", "Which emerging materials or sensing technologies could open new directions for applied engineering research?"],
        ["interdisciplinary", "engineering, environmental, cleaning, waste, water, sustainable, ecological", "How can engineers and environmental scientists work together to make industrial systems cleaner and more efficient?"],
        ["ethics", "engineering, safety, infrastructure, railway, industrial", "What responsibilities do engineers have in communicating the limits and risks of the systems they design?"],
    ],

    "International Journal of Environmental Science" => [
        ["methodology", "environmental, water, soil, air, pollution, monitoring, sampling", "Which monitoring and sampling practices make environmental data most comparable across studies?"],
        ["applications", "environmental, pollution, waste, water, treatment, recycling, remediation", "How could findings of this kind support local authorities or industries in reducing environmental impact?"],
        ["global", "climate, environmental, ecosystem, biodiversity, water, region", "How do environmental challenges of this kind differ across regions, and what can be learned from those differences?"],
        ["future", "climate, environmental, ecosystem, sustainable, circular", "Which environmental questions do you think will become more urgent for researchers over the next decade?"],
        ["interdisciplinary", "environmental, health, economic, policy, community", "How can environmental research better connect with public health, economics and policy-making?"],
    ],

    "International Journal of Medicine" => [
        ["methodology", "clinical, patients, trial, study, cohort, diagnosis, treatment, medical", "Which study designs give the most reliable evidence for questions of this kind in clinical research?"],
        ["ethics", "patients, clinical, medical, health, data, consent, trial", "How should patient privacy and informed consent be protected in medical research of this type?"],
        ["applications", "clinical, treatment, diagnosis, health, care, hospital, medical", "What would need to happen before findings in this area could change everyday clinical practice?"],
        ["interdisciplinary", "medical, health, informatics, digital, ai, data, technology", "How can clinicians and specialists in data or technology collaborate effectively on medical research?"],
        ["global", "health, public, medical, population, access, care", "How might health systems with different resources apply research of this kind?"],
    ],
];

$prompts = [];

foreach ($general as $category => $texts) {
    foreach ($texts as $text) {
        $prompts[] = ["category" => $category, "text" => $text];
    }
}

foreach ($by_journal as $journal => $items) {
    foreach ($items as [$category, $keywords, $text]) {
        $prompts[] = ["category" => $category, "journal" => $journal, "keywords" => $keywords, "text" => $text];
    }
}

return $prompts;
