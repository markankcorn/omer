const fs = require('fs');
const path = require('path');

const SEFIROT = [
  { en: 'Love', he: 'חֶסֶד', tr: 'Hesed' },
  { en: 'Strength', he: 'גְּבוּרָה', tr: 'Gevurah' },
  { en: 'Compassion', he: 'תִּפְאֶרֶת', tr: 'Tiferet' },
  { en: 'Endurance', he: 'נֶצַח', tr: 'Netzach' },
  { en: 'Humility', he: 'הוֹד', tr: 'Hod' },
  { en: 'Foundation', he: 'יְסוֹד', tr: 'Yesod' },
  { en: 'Nobility', he: 'מַלְכוּת', tr: 'Malchut' },
];

const dir = path.join(__dirname, '..', 'meditations');

// Content for each day (cleaned from user's essays)
const essays = {};

essays[1] = `Think of this as purity, starting from scratch. Remember that this occurs in context: the Second Day of Pesach where we have already left Egypt and have been liberated. The crucial first step of casting off our slavery is to get down to basics, the absolute core of everything, which is unconditional overflowing love. Generosity without restraint or qualification or reservation.

Questions for meditation: do I place conditions on love? Do I only love those who love me first? Do I only express generosity towards those that can reciprocate or do me a favor in return? Do I show love only when it's comfortable and safe?`;

essays[2] = `Love puts us in a vulnerable position. We are open to new feelings and emotions and experiences, baring our most intimate parts to another. This takes tremendous strength. Wounds are inevitable, as part of life as breathing is.

Only a fool wouldn't immediately flinch from an incoming blow and try to cover up or at least deflect. After a few of those, our hearts are closed completely. And we're back in slavery.

Remaining open despite the blows, almost because of the blows, that's true loving kindness and takes immense strength.`;

essays[3] = `It is so crucial to balance the selfish urge in intimacy with the desire to please the other. One without the other is toxic. If we sacrifice too much and place other people's needs over our own consistently, it's all too easy to lose our own sense of self. And of course the reverse, self-centered egomania, is just as harmful. The balance and moderation can be a tricky tightrope to walk.

Rabbi Simcha Bunim of P'shischa said that we should go through life with two slips of paper in our pockets. One reads "The world was created solely for me" and the other says "I am nothing but dust and ashes." Both are true at the same time, yet the sentiments are completely opposite to each other. We live in the tension between the two, a pile of dust and ashes that is the most important thing in the universe.

Sometimes we need to be reminded of our humility; sometimes of our own immense, infinite worth. On this day of balance and harmony, let us stay centered in the glorious balance, loving others and ourselves in infinite measure.`;

essays[4] = `For love to be fully realized, it must have an element of consistency. It requires discipline. I know this doesn't match with the swooning romantic love that we've been fed for a couple of centuries, but the Jewish version is much richer and deeper.

The Hasidic masters taught that Hod is the horse and Netzach are the reins, directing and guiding that strong impulse where it needs to be. Intention without discipline or guidance is dangerous, and all the more so when we are mediating this week on primary and most powerful of urges \u2014 love. But think too of how slender the reins are, thin pieces of leather or cord that would break in an instant if that's all that held back the strength of the horse. Yet only a gentle tug keeps the beast on track and turns a wild animal into a partner of immense value and use.

Our love needs guidance, consistency, rules and standards that elevate our wild urges into a higher realm. Sometimes not much, other times more. It's the conversation between horse and rider that carries us to holiness.`;

essays[5] = `As I wrote yesterday, the aspect of Hod is intimately bound up with Netzach and the metaphor that is often used is a horse and reins. Hod is the surging, instinctual, raw power that moves us forward. So when we think this week about the various facets of love and loving kindness (Hesed), we must for a day at least acknowledge and stand in awe of an unbridled passion that has enormous power.

Yes, it must be managed. Absolutely, it needs to have a higher purpose and meaning. Of course, it needs moderation. But can't we, just for a day, turn our attention to how incredible love is when it exists in its raw and uncompromising form? Like watching a wild horse run when we're a safe distance away, it's majestic and inspiring and amazing. It carries us off to places we never imagined and motivates us to move mountains.

We must have moderation in all things \u2014 including moderation. Let us today indulge in just a little bit of boundless, pure, uncompromising passion.`;

essays[6] = `What's the foundation of a long term relationship of deep intimacy? There are many answers to this. The old "never go to bed angry" has a lot to recommend it, as does the adage "do you want to be right or stay together?"

Ultimately, the real foundation for a deep and lasting bond is to actually want to have a deep and lasting bond. Setting that as a goal, putting one's focus on the long term \u2014 that's the real foundation. The answers don't matter nearly as much as asking the question day after day: how do I make this last?

There is a level of holiness that can only be reached through a long term relationship of love. The experience of spending day after day negotiating the intimacy of two souls cannot be replaced by the intensity of passion.

There is a level of joy that cannot be accessed any other way than through the kind of intimacy that comes from longevity. Our oldest friends and family are the source of joy that is unlike any other, and teach us lessons that we can learn no other way.

May we all be blessed to know a love that is founded on solid rock and that endures forever.`;

essays[7] = `Today concludes the first week of our seven week cycle of Counting the Omer, and the last day of our focus on Hesed, love or loving kindness. Malchut is translated as kingship or sovereignty, but nobility is probably the closest in modern English. For the Kabbalists, it represents the final aspect of the Upper Realm and the place where it touches and interfaces with the created world that we inhabit as humans. It's where creation is made manifest and is often identified with the Shekhinah, the feminine nature of the Creator.

So let's get practical. How are you going to make your love manifest in the world? It's all fine and dandy to have emotions, to think longingly about our beloved and ponder all the ways that we are in love. But real love is real \u2014 it's in the things we do and the words we say, not the emotions we carry in our hearts that never make it out.

Intentions aren't worth a dime. I'd much rather have someone do the right thing for utterly wrong reasons than have the best intentions of all but do evil. It's our actions that matter most, and yes having solid, pure intentions is the surest way for our actions to be good and right and enduring.

Have the courage to make love real. Risk it, express it, be sincere. Stop hiding and dissembling and dodging. Say what you mean and mean what you say and let the work of the last week come flowing powerfully and honestly into your actions.`;

essays[8] = `We move this week to an exploration of strength. What does it mean to be strong? Today, we mediate on the element of love within spiritual toughness.

Strength must always come from a place of love. If a parent is strong and unwavering in discipline, but not loving, then the discipline is cruel and will turn the heart of the child away.

If this is true for others, how much more is it true for ourselves? How often have we been judgmental about our own actions but without having that correction come from love? It's all too easy to let voices of critique become a toxic screed of abuse.

As we embrace our strength, let us ensure first and foremost that it comes from love \u2014 for each other and most of all for ourselves.`;

essays[9] = `Gevurah is strength but also includes the quality of discipline and rigor. So today let's think on the very practical and find the larger spirituality in the mundane. Things like budgets and to-do lists and diets and calendars can be frustrating for those among us who are more free-spirited and spontaneous.

There is a deep holiness in paying bills and staying within a budget. It's not sexy and nobody's going to make a commercial about the person who brings their lunch every day for two years to save up for something special. But doing the little things each and every day is the only way to build a stronger character.

Stress comes from breaking promises that we make to ourselves. You can't trust yourself to follow through, so the inner critic gets louder and louder.

Today, cast that negativity aside and be a rock, starting with the little things. Whether it's a budget or a diet or a to-do list, today is the day to stick to the plan. Strength doesn't come from nowhere, it's built day by day. Start right now, this second, and get after it.`;

essays[10] = `What does balance have to do with strength? I saw on Instagram a short video of a woman doing a "pistol squat," which looks incredibly simple: stand on one foot and lower yourself down while holding your arms straight out and the other leg. Piece of cake, right? No way. Unless you have great balance, it's impossible.

Balance comes from harmony, all of the big stuff and little details working together to accomplish a goal. If you're working against yourself, or even if parts of you are standing on the sidelines, you'll never accomplish anything. All of you has to be in harmony towards one purpose.

Today focus on the details, those little parts of character that support your larger goal. Are you hearing from your body, mind, and spirit, a harmonious strength of purpose? Or are you subtly with the small things undermining your own efforts?`;

essays[11] = `To be worthwhile, discipline must endure. It's easy to follow the plan when we feel like it. A truly strong person does what they need to do even when it's not comfortable or easy or they just don't feel like it. Getting up and getting on with it on those days when our thoughts and emotions are elsewhere is the real virtue of strength of character.

So meditate today on consistency. Am I consistent with my discipline, saying no to things that I know are bad for me because I'm following a different path? Build that inner strength by saying no when you know it's wrong. There's a bigger picture and a higher goal, something that is far more important than a fleeting temptation.

And give yourself credit when you do follow through. If you can't be your own best cheerleader, who will be? Savor and celebrate those moments when your discipline kicks in and you say no to temptation. Your soul is getting stronger every day, and that's truly something to celebrate.`;

essays[12] = `It would seem that the quality of strength or judgment (Gevurah carries both meanings intertwined) would be totally opposite of humility, so how do we explore two things that cancel each other out? In reality, humility is an absolutely crucial component of strength.

If you are not humble, you cannot truly be strong. Humility means to see our goodness as a gift that we are charged with safeguarding and cultivating, not some special achievement that we flaunt or brag about.

A judge should be the most humble of all persons, a servant of the public in the literal sense of the word, listening carefully and doing justice in a calm and evenhanded manner. And are we not all called upon to judge, if only at the most primal level between light and dark, good and bad?

So when you judge yourself or judge others, and we must not avoid these judgments for we are called to lead, bear in mind that there is no place for arrogance. True strength comes from humility, that state of repose where we stand in wonder and awe of the majesty of creation.`;

essays[13] = `It may seem obvious, but it bears repeating: the many are stronger than one. Or as the Talmud teaches, a three-fold cord is not quickly broken. This is particularly important when we are thinking of moral and spiritual development. Finding a partner to swim with you as you dive deep is a critical part. Some things we can only reach when we have that feedback from an outside perspective.

Discipline is far easier when we surround ourselves with positive reinforcements from others. Even if it's not explicit, have those non-verbal affirmations from others is immensely helpful. If everyone you know is eating healthy and going to the gym, that will soon become your norm. So too with spiritual growth.

Find yourself a partner or two or three and find a community of like-minded seekers. Your strength of character and spirit will be multiplied many times over.`;

essays[14] = `As we finish our week-long meditation on discipline and strength, we end as always with nobility and actualization. How can we use our strength of character to elevate ourselves and those around us?

Spiritual strength should always be a source of pride, but quietly. The best role models are the ones that lead by example. They show with their actions and not so much by flowery words.

Be a model of disciplined nobility for others and especially for yourself. Follow your own leadership towards a higher spiritual plane.`;

essays[15] = `We move this week to an examination of Compassion. What does it mean to be compassionate? Tiferet in the s'firot of Kabbalah sits in the middle of the two upper attributes (hesed and gevurah), receiving energy from both of them. It also feeds the two lower attributes, netzach and hod, and channels energy directly to yesod.

Compassion is understanding that you are connected to all things and all people. Your spirit receives from above and below, giving love and receiving love at the same time.

Embrace your connectedness this week. Put judgment aside especially today and enjoy the overwhelming flow of love that showers down from above.`;

essays[16] = `Sometimes the truly compassionate thing to do is to hold back. I see this from time to time with my kids. I want to keep all manner of harm away from them, any tiny scrape or scratch or hurt feelings or disappointment. Like all caring parents.

But ultimately there is, to quote eminent child psychologist Wendy Mogel, a blessing in a skinned knee. Trying and failing and learning that it doesn't break you and getting back up again to try once more, that's the deeper sense of love and compassion that we can give our children.

Think of ways today that holding back our compassion might just be the best thing for the recipient. And possibly ourselves \u2014 maybe sometimes we need that bucket of cold water to motivate us or to teach us a more lasting lesson.`;

essays[17] = `Whenever the major and minor cycles coincide (hesed of hesed, gevurah of gevurah) like today, we meditate on the true essence of the quality in all its intensity.

Too often compassion can come from a sense of duty or guilt. I feel bad for how I treated someone, so I'll go out of my way to do something good for that person or someone else, as a way to try to get the scales back into balance. Or I feel like I need to do an act of generosity because it fits my self-image as a good citizen or neighbor or parent.

Cast aside all of that today and try to do a single act of pure compassion. Not from duty or obligation or pride or self-aggrandizement, but just because we are connected each to the other. Our obligation is to give and receive in appropriate measure as we learned yesterday and the day before, and as we'll explore later in the week.

So ask yourself: Is my compassion whole and complete? Am I trying to build it and expand it every day? Am I free from ulterior motives and external compulsions or am I truly connected to all and to everyone?`;

essays[18] = `What can we do to ensure that our compassion is enduring? This is a different aspect than gevurah / discipline that we learned about two days ago, and is often associated with confidence by the Hasidic masters.

I think often of the question, "What would you do if you knew you couldn't fail?" Today we take the idea of failure out of our emotions and ponder what levels of compassion that would unlock, what heights of connectedness and spiritual excellence we would ascend to, if only we could cast aside our fear of failure.

Find ways today to be fearlessly compassionate. Connect to those parts of you that are enduring, victorious, undefeatable and inside all of them I'll bet you find compassion. Tap into your compassion without fear and you will truly touch the eternal.`;

essays[19] = `Let's flip this around today and think what it's like to receive compassion. Do we resist the help of others when it's offered to us, out of pride or our own self-regard? Even though we may need it or welcome it, do we stand back from making connections?

In order to give compassion to others, we have to be open to receiving it ourselves. Start saying yes when people offer their help. Recognize that these moments of compassion are a gift and it's a privilege to receive them.

When we know what it feels like to receive, we're in a much different position when it becomes our turn to give. It doesn't make you selfish, it just makes you human.`;

essays[20] = `As we come to the end of the week, the final aspects (today of Yesod and tomorrow of Malchut) are critical from a practical sense. How can we make these more theoretical lessons learned through meditation and contemplation of the higher concepts real and actualized in our lives?

Compassion is incredibly powerful when expressed in relationship with one other person. Focus today on a single, long-term relationship that you have with another and find ways to make compassion \u2014 connectedness \u2014 the foundation of that bond.`;

// Day 21 - empty stub (user had no content)
// Day 22-27 - user noted these were copy-pasted placeholders from Tiferet week
// Day 28 - empty stub

essays[22] = `We move this week to an examination of Netzach \u2014 endurance, ambition, the drive to persist and prevail. What does it mean to endure? Today, we meditate on the element of love within that drive.

Endurance is understanding that you are connected to all things and all people. Your spirit receives from above and below, giving love and receiving love at the same time.

Embrace your connectedness this week. Put judgment aside especially today and enjoy the overwhelming flow of love that showers down from above.`;

essays[23] = `Meditate today on your goals, your mission. Is it truly based on something eternal or is it just a defensive response that comes out of jealousy or fear? It's easy enough to cause chaos and just rip things down, criticize, flip tables, rant. Building requires stamina and discipline, and if your house is built on sand, it will not last.

What, truly, are you going after in life and why? Is your ambition based on deep conviction or just a sense that you want more than the next person?

Jealousy fades and is unworthy of the sacred spirit within you.`;

essays[24] = `Whenever the major and minor cycles coincide (hesed of hesed, gevurah of gevurah) like today, we meditate on the true essence of the quality in all its intensity.

Too often compassion can come from a sense of duty or guilt. I feel bad for how I treated someone, so I'll go out of my way to do something good for that person or someone else, as a way to try to get the scales back into balance. Or I feel like I need to do an act of generosity because it fits my self-image as a good citizen or neighbor or parent.

Cast aside all of that today and try to do a single act of pure compassion. Not from duty or obligation or pride or self-aggrandizement, but just because we are connected each to the other. Our obligation is to give and receive in appropriate measure as we learned yesterday and the day before, and as we'll explore later in the week.

So ask yourself: Is my compassion whole and complete? Am I trying to build it and expand it every day? Am I free from ulterior motives and external compulsions or am I truly connected to all and to everyone?`;

essays[25] = `What can we do to ensure that our compassion is enduring? This is a different aspect than gevurah / discipline that we learned about two days ago, and is often associated with confidence by the Hasidic masters.

I think often of the question, "What would you do if you knew you couldn't fail?" Today we take the idea of failure out of our emotions and ponder what levels of compassion that would unlock, what heights of connectedness and spiritual excellence we would ascend to, if only we could cast aside our fear of failure.

Find ways today to be fearlessly compassionate. Connect to those parts of you that are enduring, victorious, undefeatable and inside all of them I'll bet you find compassion. Tap into your compassion without fear and you will truly touch the eternal.`;

essays[26] = `Let's flip this around today and think what it's like to receive compassion. Do we resist the help of others when it's offered to us, out of pride or our own self-regard? Even though we may need it or welcome it, do we stand back from making connections?

In order to give compassion to others, we have to be open to receiving it ourselves. Start saying yes when people offer their help. Recognize that these moments of compassion are a gift and it's a privilege to receive them.

When we know what it feels like to receive, we're in a much different position when it becomes our turn to give. It doesn't make you selfish, it just makes you human.`;

essays[27] = `As we come to the end of the week, the final aspects (today of Yesod and tomorrow of Malchut) are critical from a practical sense. How can we make these more theoretical lessons learned through meditation and contemplation of the higher concepts real and actualized in our lives?

Compassion is incredibly powerful when expressed in relationship with one other person. Focus today on a single, long-term relationship that you have with another and find ways to make compassion \u2014 connectedness \u2014 the foundation of that bond.`;

// Generate all 49 files
for (let day = 1; day <= 49; day++) {
  const weekIdx = Math.floor((day - 1) / 7);
  const dayIdx = (day - 1) % 7;
  const week = SEFIROT[weekIdx];
  const d = SEFIROT[dayIdx];
  const num = String(day).padStart(2, '0');

  const body = essays[day] || '';

  const content = `+++
day = ${day}
week_sefirah = "${week.tr}"
day_sefirah = "${d.tr}"
title = "${d.en} within ${week.en}"
title_hebrew = "${d.he} שֶׁבְּ${week.he}"
+++

${body}
`;

  fs.writeFileSync(path.join(dir, `day-${num}.md`), content);
}

console.log('Done. Days with content:', Object.keys(essays).sort((a,b) => a-b).join(', '));
